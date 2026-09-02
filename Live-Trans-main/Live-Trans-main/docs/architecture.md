# Kiến trúc

> **Bản chính thức nằm ở `plan.md`** (đã chốt sau research 09/2026). File này giữ sơ đồ tổng quan + dẫn chi tiết.

## Sơ đồ tổng quan

```
┌─────────────────────────── Chrome Extension (MV3) ────────────────────────────┐
│                                                                                │
│  [Popup] bật/tắt, ngôn ngữ, trạng thái + metric (TSR, lag)                     │
│     │                                                                          │
│  [Service worker] điều phối: tabCapture streamId, token/quota queue, phiên     │
│     │                                                                          │
│  [Offscreen document]                                                          │
│     ├─ getUserMedia(tab) → <audio> loopback (vẫn nghe tab)                     │
│     ├─ AudioWorklet → PCM 16kHz mono → chunker 45s                             │
│     ├─ ASR: gemini-3.5-transcribe (verbatim + word timestamps                  │
│     │        + custom vocabulary từ glossary)                                  │
│     ├─ Segmenter: subtitle units ≤ 2 dòng × 42 ký tự                           │
│     ├─ Dịch batch 3–5 unit: gemini-3.5-flash                                   │
│     │    [mask ⟦n⟧] → [glossary chọn lọc + context 3–5 câu] → [JSON out]       │
│     ├─ Validator: placeholder roundtrip + TSR → retry 1 lần → splice ⚠        │
│     └─ Subtitle queue (theo mốc thời gian audio)                               │
│     │                                                                          │
│  [Content script] overlay phụ đề song ngữ                                      │
│  [Options] key/mode, ngôn ngữ, chunk, glossary editor, export .srt             │
│                                                                                │
│  Provider: ① DirectGemini (fetch thẳng, key user)                              │
│            ② LocalGateway (http://localhost, key trong .env — tuỳ chọn)        │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Nguyên tắc thiết kế

1. **Pipeline tách mắt xích**: capture / ASR / segment / dịch / validate / hiển thị là module độc lập, đổi được.
2. **Provider abstraction**: mọi lời gọi AI qua 1 interface — Direct hoặc Gateway, cắm thêm sau này không sửa kiến trúc.
3. **Glossary là tầng riêng**, dữ liệu người dùng (không hardcode), dùng chung cho ASR + dịch (+ PDF sau này).
4. **Validate local trước khi tốn thêm call**: placeholder roundtrip + TSR chạy miễn phí phía client; retry có hạn ngạch.
5. **Hiển thị tiến triển**: batch xong là hiện, không đợi chunk.

Chi tiết đầy đủ (bằng chứng research, pipeline từng bước, ngân sách token, API key policy, milestone, risk): **`plan.md`**.
