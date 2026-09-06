# Kiến trúc & Tính năng PDF Viewer (Live-Trans)

Tài liệu này ghi lại kiến trúc, các chế độ đọc và lịch sử tính năng của trình đọc tài liệu PDF học thuật trong Live-Trans (phiên bản `1.0.0` trở đi).

---

## 1. Tổng quan Trình đọc PDF
Live-Trans tích hợp trình đọc tài liệu khoa học song ngữ chuyên sâu (URL: `viewer.html?url=...`), giải quyết bài toán dịch paper tiếng Anh sang tiếng Việt giữ nguyên công thức toán KaTeX, bảng biểu, thuật toán và bố cục trang.

### Các thành phần chính trên Toolbar (v1.0.0)
- **Nút mở Sidebar trang**: Hiện thumbnail và trạng thái từng trang theo 1 dòng ngang gọn gàng.
- **Chế độ xem (View Mode)**: Song ngữ (`bilingual`), Chỉ bản dịch (`translated`), Chỉ bản gốc (`original`).
- **Nút Reset tỉ lệ `50:50`**: Đưa tỉ lệ chia đôi 2 pane về chính xác 50:50 và tính lại zoom fit.
- **Thanh kéo Splitter**: Kéo chuột mượt mà để tùy biến tỉ lệ chia màn hình từ 20% đến 80%.
- **Chế độ đọc (Reader Mode)**:
  - **Vision AI (Thị giác Đa phương thức) (Khuyên dùng)**: Chụp ảnh từng trang gửi Gemini 3.5 Flash-Lite, nhận diện và tái tạo Markdown + LaTeX chuẩn mực học thuật.
  - **Bảng trắng Component (Chưa hoàn thiện)**: Phân rã paper thành các component độc lập tọa độ.
  - **Markdown Dòng chảy & Overlay Đè chữ**: Đang tạm ẩn (chưa phát triển).
- **Điều hướng trang**: `< Trang X / Y >` kết hợp phím tắt cuộn.
- **Thanh chọn Thu phóng (Zoom)**: Custom dropdown dark card: `Fit Width` (tính toán độc lập 2 bên), `75%`, `90%`, `100%`, `115%`, `125%`, `150%`, `200%`.
- **Nút Dịch lại**: Xóa cache và kích hoạt dịch lại toàn bộ paper.
- **Nút Cài đặt (Icon-only)**: Mở modal cấu hình Provider (Gemini / Zen API), Model AI, API Key, Concurrency (2 - 7 luồng song song).

---

## 2. Động cơ Dịch thuật Vision AI (Multi-Worker Dual-Priority Queue)
1. **Hàng đợi Ưu tiên cao (Interactive Preemption)**:
   - Khi người dùng cuộn hoặc nhấp vào trang bất kỳ, cửa sổ các trang lân cận được chen ngang lên đỉnh hàng đợi ưu tiên với độ trễ 0ms.
2. **Hàng đợi Thác nước ngầm (Background Waterfall)**:
   - Tự động dịch tuần tự từ trang 1 đến hết trong nền với nhịp pacing 400ms để đảm bảo không vi phạm quota rate-limit (429).
3. **Multi-Worker Concurrency**:
   - Chạy đồng thời số worker theo cấu hình (mặc định 5 luồng, tối đa 7 luồng).
4. **Bộ nhớ đệm thông minh (Persistent LRU Cache)**:
   - Lưu trữ bền vững tối đa 50 bài báo trong 14 ngày trên `chrome.storage.local`.
   - Nạp tức thì 0ms khi mở lại bài báo hoặc mở lại trình duyệt Chrome.

---

## 3. Ghi chú Lịch sử Tính năng: Nút "Bố cục" (Component Layout Reset)

### Bối cảnh và Nguồn gốc:
- Trong các phiên bản ban đầu (`<= 0.4.x`), Live-Trans thử nghiệm chế độ dịch **Overlay đè chữ** và **Bảng trắng Component**.
- Ở các chế độ này, mỗi đoạn văn bản là một khối thẻ DOM riêng biệt dựa trên tọa độ bounding box trích xuất từ PDF gốc.
- Người dùng có khả năng nhấp chuột vào từng khối chữ để:
  - Kéo di chuyển khối chữ (`moveBlock` với độ lệch `dx, dy`).
  - Co giãn chiều rộng khối chữ (`resizeBlock` với chiều rộng `w`).
- Các tọa độ tùy chỉnh này được lưu vào bộ nhớ phiên:
  `sessionStorage.setItem("live_trans_layout_" + docUrl + "_p" + pageNumber, JSON.stringify(layoutOverride))`
- Nút **"Bố cục"** được đặt trên thanh công cụ nhằm cho phép người dùng **xóa sạch toàn bộ tọa độ kéo thả tùy chỉnh**, đưa tất cả các khối component trở về y hệt vị trí gốc của paper.

### Thay đổi từ phiên bản 1.0.0:
- Chế độ đọc chính thức và khuyên dùng hiện nay là **Vision AI (LaTeX dòng chảy)** — render Markdown + KaTeX học thuật từ ảnh chụp, không dùng kéo thả tọa độ pixel của từng text block.
- Vì vậy, nút **"Bố cục"** trên thanh công cụ chính đã được **loại bỏ** để tối ưu hóa không gian hiển thị cho các công cụ thiết yếu.
- Nút này vẫn được lưu giữ bên trong modal **Cài đặt** (`⟲ Đặt lại bố cục`) và mã nguồn nền tảng (`loadPageLayout`, `BlockLayoutOverride`, `resetAllLayouts`) vẫn được bảo toàn đầy đủ.

### Hướng dẫn cho nhà phát triển tương lai:
Nếu hoàn thiện chế độ **Bảng trắng Component** hoặc phát triển lại chế độ **Overlay**:
- Mã xử lý khôi phục bố cục nằm tại hàm `resetAllLayouts()` trong `extension/entrypoints/viewer/main.tsx`.
- Có thể hiển thị lại nút "Bố cục" theo điều kiện khi người dùng kích hoạt `readerMode === 'whiteboard'`.
- Tọa độ override của từng component được quản lý qua state `layoutOv` và interface `BlockLayoutOverride { dx, dy, w }`.
