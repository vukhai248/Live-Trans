# Live-Trans — Hướng dẫn cài đặt (không qua Chrome Web Store)

> Tài liệu phục vụ mốc **M5 "Đóng góp & phát hành nội bộ"** (`docs/plan.md` §9, `docs/roadmap.md`).
> Mục tiêu: giúp một bạn học sinh/sinh viên **không chuyên về máy tính** tự cài được extension,
> đồng thời minh bạch toàn bộ vấn đề **bảo mật** để người dùng yên tâm.
>
> Live-Trans là **Chrome Extension (Manifest V3)** viết bằng WXT + TypeScript + Preact. Vì hiện
> chưa phát hành lên Chrome Web Store, extension được cài theo kiểu **side-load** (tải tiện ích đã
> giải nén qua "Chế độ nhà phát triển").

## Mục lục

- [A. Cài đặt không qua Chrome Web Store](#a-cài-đặt-không-qua-chrome-web-store)
- [B. Bảo mật — những điều cần biết](#b-bảo-mật--những-điều-cần-biết)
- [D. Checklist nhanh cho người dùng cuối](#d-checklist-nhanh-cho-người-dùng-cuối)

---

## A. Cài đặt không qua Chrome Web Store

Có 2 cách, dùng đúng một trong hai:

| Cách | Dành cho | Cần gì | Độ khó |
|---|---|---|---|
| **Cách A** — dùng file `.zip` có sẵn | Người dùng cuối (học sinh/sinh viên) | Nhận file `.zip` từ người phát hành | Rất dễ (không cần code) |
| **Cách B** — tự build từ mã nguồn | Người biết code / người phát hành | Git + Node.js/npm, clone repo | Trung bình |

---

### A.1. Cách A — Dành cho người dùng cuối (đơn giản nhất)

> Trước tiên, dành cho **người phát hành** (thầy cô/trợ giảng/nhóm kỹ thuật): một lần duy nhất, bạn
> chạy lệnh đóng gói (xem [A.2](#a2-cách-b--tự-build-từ-mã-nguồn-dành-cho-người-biết-code)) để tạo tệp
> `.output/live-trans-extension-0.1.0-chrome.zip`, rồi chia sẻ tệp `.zip` đó qua Google Drive, Zalo,
> Classroom, USB… cho học sinh. **Không cần gửi mã nguồn, không cần gửi API key.**

**Người dùng thực hiện từng bước sau:**

1. **Tải và giải nén tệp `.zip`.**
   Nhận tệp `live-trans-extension-0.1.0-chrome.zip`, tải về máy, rồi nhấp chuột phải → **"Extract All…"**
   (Windows) hoặc dùng công cụ giải nén trên macOS. Quan trọng: giải nén vào một thư mục **cố định, lâu
   dài** (ví dụ `Documents\Live-Trans` hoặc `Desktop\Live-Trans`). **Đừng xoá hoặc di chuyển thư mục sau
   khi cài** — Chrome đọc trực tiếp từ thư mục này; nếu xoá/di chuyển, extension sẽ báo lỗi không tải được.

2. **Mở trang quản lý tiện ích của Chrome.**
   Mở Chrome, gõ vào thanh địa chỉ: `chrome://extensions` rồi nhấn Enter.
   (Trên Edge, gõ `edge://extensions`; trên Brave, gõ `brave://extensions`.)

3. **Bật "Chế độ nhà phát triển" (Developer mode).**
   Ở góc trên bên phải trang `chrome://extensions`, tìm nút gạt **"Developer mode"** (Chế độ nhà phát
   triển) và bật nó lên. (Tên tiếng Việt có thể là "Chế độ dành cho nhà phát triển".) Sau khi bật, thanh
   công cụ sẽ hiện thêm các nút "Load unpacked", "Pack extension", "Update".

4. **Tải tiện ích đã giải nén (Load unpacked).**
   Nhấn nút **"Load unpacked"** (Tải tiện ích đã giải nén). Một cửa sổ chọn thư mục hiện ra — hãy **chọn
   thư mục vừa giải nén ở bước 1** (thư mục **chứa trực tiếp tệp `manifest.json`** bên trong), rồi nhấn
   "Select Folder".

   > Mẹo: nếu bạn tự build (Cách B) và chọ file từ thư mục `.output/chrome-mv3`, hãy bật "Hiện tệp/đối
   > tượng ẩn" trong cửa sổ chọn thư mục hoặc gõ trực tiếp đường dẫn, vì `.output` là thư mục ẩn.

5. **Kiểm tra extension xuất hiện.**
   Thẻ **Live-Trans** sẽ xuất hiện trong danh sách tiện ích với biểu tượng logo. Nhấn nút ghim (hình ghim)
   trên thanh công cụ Chrome để đưa biểu tượng Live-Trans ra ngoài cho dễ bấm.

6. **Nhập API key (bắt buộc để dịch thật).**
   Mặc định extension chạy ở chế độ **Demo** (chạy thử, không cần key). Để dịch thật bằng Gemini:
   nhấp chuột phải vào biểu tượng Live-Trans → **"Tùy chọn"** (Options) → mở tab **Cài đặt Live-Trans**
   → chọn chế độ **Direct** → dán **Gemini API key của riêng bạn** vào ô "Gemini API key" → **"Lưu cài
   đặt"**. Hướng dẫn tạo key an toàn ở phần [B.2](#b2-tạo-api-key-bị-giới-hạn-restricted-key).

> Lưu ý về hình ảnh minh hoạ: bản tài liệu này mô tả từng bước bằng chữ để không phụ thuộc vào ảnh chụp
> màn hình (giao diện Chrome có thể đổi giữa các phiên bản). Người phát hành có thể chèn ảnh chụp màn hình
> tương ứng vào ngay dưới mỗi bước nếu cần.

---

### A.2. Cách B — Tự build từ mã nguồn (dành cho người biết code)

Yêu cầu: Git, Node.js ≥ 20 và `npm`. Các lệnh dưới đây là **đúng với `extension/package.json` hiện tại**
(đã kiểm tra — xem mục scripts trong tệp đó):

```bash
# 1) Lấy mã nguồn
git clone <đường-dẫn-repo-live-trans>
cd Live-Trans/extension

# 2) Cài dependency (chỉ chạy lần đầu)
npm install

# 3) Đóng gói thành file .zip để chia sẻ / side-load
npm run zip
```

Sau khi chạy `npm run zip`, file thành phẩm nằm tại:

```text
extension/.output/live-trans-extension-0.1.0-chrome.zip
```

Nếu muốn tự cài ngay mà không cần giải nén `.zip`, bạn có thể chạy `npm run build` rồi dùng nút
**"Load unpacked"** trỏ thẳng tới thư mục build:

```bash
npm run build
# chọn thư mục: extension/.output/chrome-mv3  (thư mục chứa manifest.json)
```

Các lệnh khác hiện có trong `extension/package.json` (tham khảo thêm): `npm run dev` (chạy dev + HMR),
`npm run check` (lint + typecheck + unit test), `npm run typecheck`, `npm run lint`, `npm run test`.

---

### A.3. Giới hạn khi cài side-load

- **Không tự động cập nhật.** Extension cài qua "Load unpacked" không tự cập nhật. Khi nhóm phát hành ra
  bản mới (fix lỗi, thêm tính năng), người dùng phải **tải bản `.zip` mới, giải nén, rồi nhấn nút
  "Update" (biểu tượng mũi tên tròn) trên thẻ Live-Trans tại `chrome://extensions` — hoặc gỡ và cài lại
  từ đầu theo [Cách A](#a1-cách-a--dành-cho-người-dùng-cuối-đơn-giản-nhất).
- **Chrome có thể nhắc nhở.** Trên một số máy, Chrome hiển thị cảnh báo "Chế độ nhà phát triển"/"tiện ích
  bên ngoài Chrome Web Store" khi khởi động. Đây là nhắc nhở chung của Chrome cho MỌI extension side-load,
  không phải lỗi của Live-Trans; nhấn "Bỏ qua"/"Dismiss" như bình thường.
- **Cập nhật key/thuật ngữ là của riêng bạn.** Vì mỗi người nhập key riêng và lưu trên máy, việc nâng cấp
  không làm mất cài đặt miễn là bạn cập nhật *tại chỗ* (không xoá extension trước khi cập nhật).

---

### A.4. Trình duyệt hỗ trợ

Live-Trans dùng 2 API đặc thù của Chromium ở Manifest V3 là **`chrome.tabCapture`** (bắt âm thanh tab) và
**`chrome.offscreen`** (văn bản nền để xử lý âm thanh không bị ngắt). Vì vậy:

- ✅ Hỗ trợ: **Google Chrome, Microsoft Edge, Brave, Opera, Arc, Chromium** (các trình duyệt nhân Chromium),
  phiên bản gần đây.
- ❌ Chưa hỗ trợ: **Firefox** (và Safari). Firefox không có `offscreen` / `tabCapture` theo đúng cơ chế
  MV3 mà Live-Trans dựa vào, nên chưa thể cài. Việc hỗ trợ Firefox nằm ngoài phạm vi hiện tại.

---

## B. Bảo mật — những điều cần biết

### B.1. API key KHÔNG được đóng gói vào extension

- **Key là của riêng từng người dùng.** Extension **không hề nhúng** API key vào mã nguồn hay bản build.
  Người dùng tự tạo key của mình ([B.2](#b2-tạo-api-key-bị-giới-hạn-restricted-key)) và tự nhập vào trang
  **Cài đặt (Options)** → chế độ **Direct**.
- **Key được lưu trên máy bạn, không đẩy lên đám mây.** Key được lưu trong `chrome.storage.local` (xem
  `extension/lib/settings.ts`, hàm `loadSettings`/`saveSettings`), **KHÔNG dùng `chrome.storage.sync`** —
  nghĩa là key/glossary/cấu hình chỉ nằm trong profile Chrome trên chính máy đó, không đồng bộ lên tài
  khoản Google của bạn.
- **Nhưng hãy hiểu đúng mức "chỉ lưu trên máy":** `chrome.storage.local` lưu dạng văn bản thường (không mã
  hoá) trong profile Chrome. Ai có quyền truy cập vào **cùng tài khoản hệ điều hành** của bạn mới đọc được.
  Vì vậy: chỉ cài trên máy của chính mình, khoá máy khi rời máy, và **không dùng chung profile Chrome với
  người lạ**.
- **Ở chế độ Direct, key chỉ được gửi tới Google.** Khi dịch, extension đọc key từ storage rồi gửi trong
  header `x-goog-api-key` tới đúng `generativelanguage.googleapis.com` (xem
  `extension/lib/providers/direct-gemini.ts`). Key không được gửi tới bên thứ ba nào khác.
- Mở rộng: nếu muốn **giữ key tập trung một chỗ, không phát cho từng máy**, dùng **chế độ Gateway**
  ([B.3](#b3-chế-độ-gateway-nâng-cao)).

### B.2. Tạo API key bị GIỚI HẠN (restricted key)

Google từ ~6/2026 bắt đầu từ chối key "không giới hạn", và từ ~9/2026 key chuẩn không-giới-hạn bị từ chối
hoàn toàn; key mới tạo mặc định là dạng "auth key". Vì vậy hãy tạo key **chỉ giới hạn cho Gemini API**,
không trao quyền rộng. Có 2 đường, chọn một:

**Đường 1 — Google AI Studio (đơn giản, khuyến nghị cho người dùng cuối):**

1. Mở <https://aistudio.google.com> và đăng nhập bằng tài khoản Google của bạn.
2. Vào mục **API keys** (biểu tượng chìa khoá / menu "Get API key").
3. Nhấn **"Create API key"** (Tạo khoá API), chọn project nếu được hỏi (nếu chưa có project thì chọn/tạo
   một project mới bất kỳ).
4. Tìm khoá vừa tạo trong danh sách → nhấn **"Add restrictions"** (Thêm giới hạn).
5. Chọn **"Restrict to Gemini API only"** (Chỉ giới hạn cho Gemini API).
6. Nhấn **"Restrict key"** (Giới hạn khoá) để xác nhận, rồi **sao chép khoá**.

**Đường 2 — Google Cloud Console (chi tiết, dành cho người quen dùng Cloud):**

1. Mở <https://console.cloud.google.com> → chọn hoặc tạo project.
2. Bật API **"Generative Language API"** (nếu chưa): vào *APIs & Services → Library*, tìm "Generative
   Language API" → Enable.
3. Vào **APIs & Services → Credentials → Create credentials → API key**. Khoá mới xuất hiện trong danh sách.
4. Nhấn vào khoá → mục **"API restrictions"** → chọn **"Restrict key"** → trong danh sách API, chỉ chọn
   **"Generative Language API"** (đây chính là API mà Gemini/extension dùng). Bỏ chọn các API khác.
5. (Tuỳ chọn) Mục **"Application restrictions"** để "None" là đủ cho người dùng cuối (không cần khoá theo
   IP/tên miền).
6. **Save** và sao chép chuỗi khoá.

**Lưu ý chung:**

- Chuỗi khoá thường bắt đầu bằng `AIza…` (dạng chuẩn) hoặc `AQ…` (dạng auth key mới). Cả hai đều dùng
  được; ô nhập trong Options chấp nhận chuỗi khoá dán nguyên văn.
- Đây là **key cá nhân** — đừng đăng công khai, đừng gửi trong nhóm chat, đừng nhét vào code/repo. Ai có
  key của bạn là dùng hạn mức miễn phí của bạn.
- Nếu nghi ngờ key bị lộ: về AI Studio/Cloud Console **xoá khoá đó** và tạo khoá mới ngay.

### B.3. Chế độ Gateway (nâng cao)

Ngoài chế độ **Direct** (key nằm trên từng máy người dùng), Live-Trans còn có chế độ **Gateway**:

- **Ý tưởng:** một máy chủ nhỏ chạy `gateway/gateway.mjs` (Node thuần, **không cần dependency**), giữ API
  key trong tệp `.env` tại `gateway/.env` (file này **đã bị gitignore**, không lên repo). Người dùng chỉ
  cần trỏ extension vào địa chỉ gateway (mặc định `http://localhost:8787`) — **không cần nhập key**. Key
  được giữ tập trung ở một nơi, không phát tán cho từng máy.
- **Cách chạy (trên 1 máy, cho chính mình):**

  ```bash
  # tạo file gateway/.env với nội dung:
  GEMINI_API_KEY=<key-của-bạn>

  node gateway/gateway.mjs     # lắng nghe tại http://localhost:8787
  ```

  Rồi trong **Cài đặt Live-Trans** chọn chế độ **Gateway**, giữ nguyên URL
  `http://localhost:8787` (hoặc sửa nếu bạn đổi cổng bằng biến môi trường `PORT`).
  Khi cấu hình xong, extension chỉ gửi/nhận dữ liệu qua `http://localhost:…` tới gateway; việc gọi Gemini
  (và giữ key) diễn ra ở gateway, không phải ở trình duyệt.

- **Cảnh báo (quan trọng):** `gateway.mjs` hiện ở giai đoạn **bản xem trước (preview)** — xem chú thích
  "preview (full hardening lands in M3)" ngay đầu file. Bản này trả `Access-Control-Allow-Origin: *` và
  **chưa có lớp xác thực**, nên chỉ nên chạy trên `localhost` cho chính bạn. **Đừng mở gateway ra mạng công
  cộng** hoặc cho cả lớp trỏ tới một máy chưa được gia cố bảo mật (ví dụ chưa đặt token xác thực, chưa
  hạn chế nguồn gọi). Khi cần phát cho cả lớp, hãy chờ bản M3 (gia cố bảo mật chính thức).

### B.4. Quy định về dữ liệu (privacy & hạn mức)

- **Âm thanh được gửi lên Google.** Để phiên âm và dịch, Live-Trans gửi **âm thanh của tab video** (dưới
  dạng chunk WAV) tới Gemini (Google). Đây là bản chất của dịch máy bằng đám mây: giọng nói trong video
  phải được gửi lên để xử lý.
- **Free tier & chính sách dữ liệu.** Ở gói **miễn phí (free tier)**, Google có thể dùng dữ liệu âm
  thanh/văn bản để cải thiện sản phẩm (ở gói trả phí thì không). Cảnh báo này đã được hiển thị ngay trong
  trang **Cài đặt** (xem dòng "Free tier: dữ liệu âm thanh/văn bản…" ở `extension/entrypoints/options/App.tsx`).
- **Không dùng cho nội dung nhạy cảm.** Vì âm thanh được gửi lên đám mây, **không nên** dùng Live-Trans cho
  nội dung nhạy cảm, bí mật cá nhân/nghề nghiệp, hay video có thông tin riêng tư. Phù hợp nhất là các bài
  giảng, video học thuật công khai (YouTube, Coursera, Udemy…).
- **Hạn mức free tier.** Gói miễn phí có giới hạn số request theo mỗi model (rate limit). Khi dùng nhiều,
  có thể gặp lỗi **429** (quá hạn mức) tạm thời và UI sẽ tự "lùi lại" (backoff) rồi thử lại. Xem hạn mức cụ
  thể của từng model tại <https://aistudio.google.com/rate-limit>. Chi phí khi cần mở rộng (thanh toán cá
  nhân) rất thấp việc dịch video thông thường (tham khảo bảng giá Gemini: âm thanh ~25 token/giây).

### B.5. Các quyền (permissions) mà extension yêu cầu — và vì sao

Nguồn: `extension/wxt.config.ts`. Khi cài, Chrome liệt kê các quyền này; bảng dưới giải thích lý do để bạn
yên tâm khi cấp.

| Quyền | Vì sao cần |
|---|---|
| `storage` | Lưu cài đặt, API key và glossary của bạn trong `chrome.storage.local` (chỉ trên máy). |
| `tabCapture` | Bắt luồng **âm thanh** của tab video (YouTube/Coursera/Udemy) để phiên âm. |
| `offscreen` | Chạy việc thu và xử lý âm thanh ở một "văn bản nền", không bị Chrome tắt giữa chừng. |
| `activeTab` | Chỉ tác động lên tab bạn đang mở **khi bạn chủ động bấm** nút dịch. |
| `scripting` | Tiêm overlay **phụ đề** lên trang video để hiển thị bản dịch. |
| `tabs` | Biết tab nào đang phát để gắn đúng overlay phụ đề và chặn chạy trùng. |
| Host permissions `<all_urls>` | Overlay phụ đề phải chạy được trên **mọi trang video**, không biết trước tên miền cụ thể (YouTube, Coursera, Udemy, …). Đây là quyền rộng vì công cụ dịch trên tab bất kỳ; extension **không** đọc nội dung trang ngoài việc hiển thị overlay phụ đề. |

> Nếu vẫn còn băn khoăn về `<all_urls>`: đây là đánh đổi có chủ đích của một công cụ "dịch bất kỳ tab
> video nào". Đã được ghi rõ trong `docs/plan.md` §7 — không ẩn giấu.

### B.6. `GEMINI_API_KEY` và `.gitignore` — dành cho người phát triển

- **Quy tắc bắt buộc:** mọi file chứa secret (`.env`, `.env.*`) phải nằm trong `.gitignore`, để **không bao
  giờ** bị commit lên repo.
- **Đã xác nhận repo cấu hình đúng.** `.gitignore` ở gốc repo hiện có:

  ```gitignore
  # Env & secrets
  .env
  .env.*
  !.env.example
  ```

  Khi kiểm tra bằng `git check-ignore`, cả `.env` (gốc repo) và `gateway/.env` đều được xác nhận là
  **bị bỏ qua** — tức là không bị theo dõi bởi git.
- **Lưu ý dành cho người phát hành:**
  - Không bao giờ chạy `git add -f` cho file `.env`, và không dán key thật vào prompt chat/issue/README.
  - Nên tạo sẵn một file mẫu `.env.example` (không chứa key thật, chỉ có `GEMINI_API_KEY=YOUR_KEY_HERE`) để
    thành viên mới dễ tạo `.env`. Dòng `!.env.example` trong `.gitignore` đã được chuẩn bị sẵn cho việc này
    (hiện repo chưa có file ví dụ này — nhóm có thể bổ sung).
  - Khi phát hiện key đã lộ (kể cả chỉ trong một commit cũ), hãy **xoá/đổi key trên Google ngay** rồi mới
    xử lý lịch sử git, vì xoá khỏi git không thu hồi được key đã lộ.

---

## C. Sau khi cài xong (kiểm tra nhanh)

1. Mở một video tiếng Anh trên YouTube/Coursera/Udemy.
2. Bấm biểu tượng Live-Trans → chọn "Dịch tab này" (hoặc nút tương ứng trong popup), cấp quyền chọn tab/âm
   thanh nếu Chrome hỏi.
3. Phụ đề dịch sẽ hiện dần (bản dịch to, bản gốc nhỏ bên dưới). Chỉnh cỡ chữ, ngôn ngữ đích, chunk… trong
   **Cài đặt → Chung**; thêm thuật ngữ học thuật để không bị dịch sai ở **Cài đặt → Glossary**.

> Lưu ý đã biết: phụ đề bám theo dòng **âm thanh đang phát**, không tự dịch lại đoạn đã phát nếu bạn tua
> lại video (xem `docs/plan.md` §3 "Đồng bộ").

---

## D. Checklist nhanh cho người dùng cuối

Để bắt đầu, chỉ cần:

1. Tải file `.zip` Live-Trans → giải nén vào thư mục cố định (đừng xoá sau này).
2. Vào `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục vừa giải nén.
3. Mở **Cài đặt Live-Trans** → chọn chế độ **Direct** → dán **Gemini API key của bạn** (tạo key chỉ-giới-hạn-
   Gemini theo [B.2](#b2-tạo-api-key-bị-giới-hạn-restricted-key)) → **Lưu cài đặt**.
4. Mở video giảng → bấm biểu tượng Live-Trans → bắt đầu dịch.

Đủ bốn bước trên là dịch được. Mọi câu hỏi về key, quyền và dữ liệu đã được giải thích ở phần [B](#b-bảo-mật--những-điều-cần-biết).
