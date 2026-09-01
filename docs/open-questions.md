# Các câu hỏi mở — cần chốt trước khi scaffold code

> Danh sách này là đầu vào cho buổi thảo luận kiến trúc. Mỗi mục ghi rõ các phương án và đánh giá ban đầu (chưa phải quyết định).

## 1. Hình thức sản phẩm (phía người dùng)

| Phương án | Ưu | Nhược |
|-----------|----|----|
| **A. Chrome/Edge extension (MV3)** | `tabCapture`/`offscreen` bắt được audio mọi tab video (YouTube, Coursera...); overlay phụ đề ngay trên trang; cài nhẹ, không cần app rời | Bị giới hạn API của từng trình duyệt; publish store cần duyệt |
| **B. Desktop app (Electron/Tauri)** | Bắt được âm thanh toàn hệ thống (loopback), kể cả app ngoài trình duyệt | Nặng, build đa nền tảng phức tạp, khó overlay lên video, khó phân phối |
| **C. Extension + Web app** | Extension cho live; web app cho upload file audio/PDF (phục vụ Giai đoạn 3) | Phạm vi rộng hơn, phải maintain 2 mặt tiền |

**Đánh giá ban đầu:** A là ứng viên chính cho MVP (bắt audio theo tab là đúng bài toán), C là đích đến khi vào Giai đoạn 3.

## 2. Backend stack

| Phương án | Ưu | Nhược |
|-----------|----|----|
| **A. Python + FastAPI** | Hệ sinh thái AI/ASR mạnh nhất: faster-whisper, WhisperX, Argos Translate, NLLB đều Python; WebSocket streaming tốt | Team phải làm 2 ngôn ngữ (TS + Python) |
| **B. Node.js + TypeScript** | Đồng nhất ngôn ngữ với frontend | Lựa chọn model ASR/dịch local hạn chế, chủ yếu gọi API ngoài |

**Đánh giá ban đầu:** A phù hợp định hướng "local model, chi phí ~0".

## 3. Tooling quản lý package

- `npm + uv` (mặc định có sẵn, hiện đại cho Python)
- `pnpm + uv` (tiết kiệm disk cho monorepo, cần cài thêm)
- `npm + pip/venv` (truyền thống, không cài thêm gì)

## 4. ASR (speech-to-text)

| Phương án | Ưu | Nhược |
|-----------|----|----|
| **Local: faster-whisper / WhisperX** | Miễn phí, riêng tư, chạy offline; cần GPU/CPU khá | Máy yếu sẽ chậm; phải tải model |
| **API free-tier (Groq, Gemini...)** | Không cần máy mạnh, nhanh | Giới hạn quota; audio phải rời máy |

**Đánh giá ban đầu:** kiến trúc phải là provider-agnostic, mặc định local, API làm phương án dự phòng.

## 5. Dịch thuật (translate)

| Phương án | Ưu | Nhược |
|-----------|----|----|
| **LLM (Gemini free-tier, model mở...)** | Giữ thuật ngữ tốt nhất nhờ prompt + glossary; xử lý ngữ cảnh | Quota; chất lượng phụ thuộc model |
| **Model dịch truyền thống (Argos, NLLB)** | Miễn phí hoàn toàn, chạy local, nhanh | Khó kiểm soát việc giữ thuật ngữ |
| **Hybrid** | LLM cho bản dịch chính, truyền thống làm fallback | Phức tạp hơn |

## 6. Chiến lược giữ thuật ngữ (benchmark chất lượng dự án)

Đây không chỉ là chuyện "model tốt hay không" — cần thiết kế chủ động:

- Glossary bắt buộc: thuật ngữ + code/lệnh được đánh dấu "giữ nguyên văn" trước khi dịch
- Prompt/instruction cho LLM: liệt kê token không được dịch
- Post-processing: đối chiếu kết quả với glossary, cảnh báo khi bị dịch
- Câu hỏi: glossary mặc định nạp từ đâu (tự xây hay dùng nguồn có sẵn)?

## 7. Vận hành & phân phối

- Backend chạy đâu: máy người dùng (self-host, đúng tinh thần miễn phí) hay server chung?
- Phân phối extension: Chrome Web Store (cần fee đăng ký dev) hay side-load (.zip) cho nhóm nhỏ trước?
- Quyền riêng tư: âm thanh rời máy chỉ khi người dùng bật provider API — hiển thị rõ trong settings.

## 8. Mở khác

- ASR tự detect ngôn ngữ hay người dùng chọn sẵn?
- Có cần dịch chiều ngược (Việt → Anh)?
- Có làm dịch text trên trang web (không phải audio) không?
