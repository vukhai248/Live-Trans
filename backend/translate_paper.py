#!/usr/bin/env python
"""Live-Trans — Dịch paper/PDF giữ nguyên layout (backend MVP, 2026-09-03).

Pipeline (xem HANDOFF.md §1 + plan.md §10):
  1. PyMuPDF tách text block kèm tọa độ (mỗi block: 1 đoạn chữ liền mạch).
  2. Dịch batch bằng `gemini-3.5-flash-lite` (JSON in/out, thinking MINIMAL,
     glossary giữ thuật ngữ — tái dùng nguyên tắc mask/glossary của video path).
  3. Redact chữ gốc ĐÚNG block (ảnh/hình vẽ/vector KHÔNG bị đụng).
  4. Chèn bản dịch vào đúng bbox bằng insert_htmlbox (font Noto Sans có dấu
     tiếng Việt; tự thu nhỏ chữ nếu bản dịch dài hơn gốc).

Usage:
  python translate_paper.py samples/2302.07121.pdf
  python translate_paper.py https://arxiv.org/pdf/xxxx -o output/x.pdf
  python translate_paper.py input.pdf --pages 1-3 --lang vi
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import pymupdf
from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parents[1]
BACKEND = Path(__file__).resolve().parent
MODEL = "gemini-3.5-flash-lite"
BATCH_SIZE = 12
MAX_429_RETRIES = 5

CSS = """
@font-face { font-family: noto; src: url(NotoSans-Regular.ttf); }
@font-face { font-family: noto; src: url(NotoSans-Bold.ttf); font-weight: bold; }
body { font-family: noto; margin: 0; font-size: 9.5pt; line-height: 1.22; }
"""


# ---------------------------------------------------------------- env & key

def load_api_key() -> str:
    env_file = ROOT / ".env"
    if env_file.exists():
        m = re.search(r"^GEMINI_API_KEY=(.+)$", env_file.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip()
    import os

    return os.environ.get("GEMINI_API_KEY", "")


def load_glossary() -> list[dict]:
    for p in (ROOT / "tests/fixtures/golden-glossary.json",):
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8")).get("terms", [])
            except Exception:
                pass
    return []


# ---------------------------------------------------------------- input

def fetch_pdf(src: str) -> tuple[str, bytes]:
    """URL → (filename, bytes); local path → đọc file."""
    if re.match(r"^https?://", src):
        name = src.rstrip("/").split("/")[-1] or "paper"
        if not name.endswith(".pdf"):
            name += ".pdf"
        req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0 (Live-Trans)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return name, r.read()
    p = Path(src)
    return p.name, p.read_bytes()


def parse_pages(spec: str | None, total: int) -> list[int]:
    """'1-3,5' → [0,1,2,4]. None → tất cả."""
    if not spec:
        return list(range(total))
    out: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            out.update(range(int(a) - 1, int(b)))
        else:
            out.add(int(part) - 1)
    return sorted(i for i in out if 0 <= i < total)


# ---------------------------------------------------------------- extract

def extract_blocks(doc: pymupdf.Document, pages: list[int]) -> list[dict]:
    """Block text + bbox + style flags. Bỏ block ảnh (type 1) và text rác."""
    blocks = []
    for pno in pages:
        page = doc[pno]
        for b in page.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            lines = []
            bold_italic = 0
            n_spans = 0
            for line in b.get("lines", []):
                spans = []
                for sp in line.get("spans", []):
                    text = sp.get("text", "")
                    if text.strip():
                        spans.append(text)
                        bold_italic += sp.get("flags", 0) & (2 | 16)
                        n_spans += 1
                if spans:
                    lines.append("".join(spans))
            text = "\n".join(lines).strip()
            if len(text) < 3:
                continue
            blocks.append(
                {
                    "page": pno,
                    "bbox": tuple(b["bbox"]),
                    "text": text,
                    "bold": n_spans > 0 and bold_italic >= n_spans,  # đa số span đậm/nghiêng
                }
            )
    return blocks


# ---------------------------------------------------------------- translate

def build_prompt(items: dict[str, str], glossary: list[dict], target_lang: str) -> str:
    rules = []
    for t in glossary:
        if t["type"] in ("command", "code"):
            rules.append(f'- "{t["term"]}": giữ NGUYÊN VĂN, không dịch')
        elif t.get("vi"):
            rules.append(f'- "{t["term"]}" luôn dịch là "{t["vi"]}"')
        else:
            rules.append(f'- "{t["term"]}": giữ nguyên văn')
    glossary_block = "\n".join(rules) if rules else "(không có)"

    payload = json.dumps(items, ensure_ascii=False, indent=1)
    return f"""Bạn là dịch giả bài báo khoa học. Dịch mỗi đoạn sau sang {target_lang}.

QUY TẮC BẮT BUỘC:
1. Giữ NGUYÊN VĂN (không dịch, không biến dạng): lệnh/code/tên định danh, ký hiệu toán, công thức, trích dẫn [1,2] hay (Smith et al., 2020), số liệu, tên riêng, URL, tên model/thuật toán.
2. Thuật ngữ theo bảng dưới đây (bắt buộc):
{glossary_block}
3. Dịch tự nhiên, chính xác học thuật; KHÔNG thêm giải thích, không thêm bớt nội dung.
4. Giữ mỗi bản dịch là MỘT đoạn văn liền (không xuống dòng trừ khi gốc có \\n).
5. Trả về ĐÚNG JSON:{{"id":"bản dịch",...}} với ĐỦ id đã cho, không thêm trường khác.

Các đoạn cần dịch (JSON, key=id):
{payload}"""


RETRY_IN_RE = re.compile(r"retry in ([\d.]+)\s*s", re.I)


def translate_batch(
    client: genai.Client, items: dict[str, str], glossary: list[dict], target_lang: str
) -> dict[str, str]:
    """Dịch 1 batch {id: text}. Retry 429 theo 'retry in Xs'. Thất bại → giữ gốc."""
    prompt = build_prompt(items, glossary, target_lang)
    for attempt in range(MAX_429_RETRIES + 1):
        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
                config=types.GenerateContentConfig(
                    thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            raw = (resp.text or "").strip()
            m = re.search(r"\{.*\}", raw, re.S)
            data = json.loads(m.group(0) if m else raw)
            out = {}
            for k, v in items.items():
                t = data.get(k)
                out[k] = str(t).strip() if isinstance(t, str) and t.strip() else v
            return out
        except Exception as e:  # 429 quota / mạng / JSON hỏng
            msg = str(e)
            wait_m = RETRY_IN_RE.search(msg)
            if wait_m and attempt < MAX_429_RETRIES:
                wait = min(float(wait_m.group(1)) + 1.0, 65.0)
                print(f"    429/HTTP lỗi — chờ {wait:.0f}s rồi retry (lần {attempt + 1})")
                time.sleep(wait)
                continue
            if attempt < MAX_429_RETRIES and not wait_m:
                time.sleep(2**attempt)
                continue
            print(f"    !! batch thất bại, giữ nguyên gốc: {msg[:160]}")
            return dict(items)
    return dict(items)


def translate_all(
    client: genai.Client, blocks: list[dict], glossary: list[dict], target_lang: str
) -> list[dict]:
    """Dịch theo batch + dedupe (header/footer lặp lại chỉ dịch 1 lần)."""
    cache: dict[str, str] = {}
    todo_texts: list[str] = []
    seen: set[str] = set()
    for b in blocks:
        h = hashlib.md5(b["text"].encode()).hexdigest()
        b["hash"] = h
        if h not in seen:
            seen.add(h)
            todo_texts.append(b["text"])

    total_batches = (len(todo_texts) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"Dịch {len(todo_texts)} đoạn duy nhất ({len(blocks)} block) ≈ {total_batches} batch...")
    for i in range(0, len(todo_texts), BATCH_SIZE):
        chunk = todo_texts[i : i + BATCH_SIZE]
        items = {f"t{j}": t for j, t in enumerate(chunk)}
        result = translate_batch(client, items, glossary, target_lang)
        for j, t in enumerate(chunk):
            cache[hashlib.md5(t.encode()).hexdigest()] = result.get(f"t{j}", t)
        print(f"  batch {i // BATCH_SIZE + 1}/{total_batches} xong ({i + len(chunk)}/{len(todo_texts)} đoạn)")

    for b in blocks:
        b["translation"] = cache.get(b["hash"], b["text"])
    return blocks


# ---------------------------------------------------------------- render

def html_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_translated(doc: pymupdf.Document, blocks: list[dict], pages: list[int]) -> None:
    """Redact text gốc (giữ ảnh + vector) rồi chèn bản dịch đúng bbox."""
    by_page: dict[int, list[dict]] = {}
    for b in blocks:
        by_page.setdefault(b["page"], []).append(b)

    redact_kw: dict = {"images": pymupdf.PDF_REDACT_IMAGE_NONE}
    try:
        redact_kw["graphics"] = pymupdf.PDF_REDACT_LINE_ART_NONE
    except AttributeError:
        pass

    archive = pymupdf.Archive(str(BACKEND / "fonts")) if (BACKEND / "fonts/NotoSans-Regular.ttf").exists() else None

    for pno in pages:
        page = doc[pno]
        pblocks = by_page.get(pno, [])
        for b in pblocks:
            page.add_redact_annot(pymupdf.Rect(b["bbox"]))
        if pblocks:
            page.apply_redactions(**redact_kw)
        for b in pblocks:
            rect = pymupdf.Rect(b["bbox"])
            rect.x0 -= 0.5
            rect.y0 -= 0.5
            rect.x1 += 2.0
            rect.y1 += 2.0
            text = b["translation"] or b["text"]
            html = html_escape(text).replace("\n", "<br/>")
            if b.get("bold"):
                html = f"<b>{html}</b>"
            try:
                page.insert_htmlbox(rect, html, css=CSS, archive=archive, scale_low=0)
            except Exception as e:
                print(f"    ! chèn block p{pno + 1} thất bại ({e}) — dùng insert_text")
                try:
                    page.insert_text((rect.x0, rect.y0 + 9), text[:400], fontsize=8, fontname="helv")
                except Exception:
                    pass


# ---------------------------------------------------------------- main

def main() -> int:
    global BATCH_SIZE
    ap = argparse.ArgumentParser(description="Live-Trans PDF/paper translator")
    ap.add_argument("src", help="URL hoặc đường dẫn file PDF")
    ap.add_argument("-o", "--output", help="File PDF đầu ra (mặc định: backend/output/<tên>.vi.pdf)")
    ap.add_argument("--lang", default="tiếng Việt", help="Ngôn ngữ đích (mặc định: tiếng Việt)")
    ap.add_argument("--pages", help='Ví dụ "1-3,7" — chỉ dịch các trang này (mặc định: tất cả)')
    ap.add_argument("--batch", type=int, default=BATCH_SIZE)
    args = ap.parse_args()

    global BATCH_SIZE
    BATCH_SIZE = max(1, args.batch)

    key = load_api_key()
    if not key:
        print("Thiếu GEMINI_API_KEY (đặt trong .env ở gốc repo)")
        return 2

    name, data = fetch_pdf(args.src)
    doc = pymupdf.open(stream=data, filetype="pdf")
    pages = parse_pages(args.pages, len(doc))
    print(f"Paper: {doc.metadata.get('title') or name} — {len(doc)} trang, dịch {len(pages)} trang")

    blocks = extract_blocks(doc, pages)
    print(f"Tách được {len(blocks)} text block")

    client = genai.Client(api_key=key)
    glossary = load_glossary()
    blocks = translate_all(client, blocks, glossary, args.lang)

    render_translated(doc, blocks, pages)

    out = Path(args.output) if args.output else BACKEND / "output" / f"{Path(name).stem}.{args.lang[:2]}.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out), garbage=3, deflate=True)
    print(f"XONG → {out} ({out.stat().st_size / 1e6:.1f} MB)")

    cache_file = out.with_suffix(".translations.json")
    cache_file.write_text(
        json.dumps(
            [{"page": b["page"] + 1, "text": b["text"], "translation": b["translation"]} for b in blocks],
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"Bản dịch thô (đối chiếu) → {cache_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
