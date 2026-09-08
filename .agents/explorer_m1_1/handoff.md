# BÁO CÁO KHẢO SÁT & BÀN GIAO KỸ THUẬT: KHỐI SETTINGS MODAL & TOOLBAR
**Explorer**: M1-1  
**Target File**: `extension/entrypoints/viewer/main.tsx` (Tổng số dòng hiện tại: 2,429 dòng)  
**Ngày thực hiện**: 2026-09-08  
**Trạng thái**: Hoàn tất khảo sát chuyên sâu (High Thinking Mode)  

---

## 1. OBSERVATION (Quan sát thực tế & Dữ liệu thực chứng)

### 1.1. Tổng quan vị trí 2 khối logic trong `extension/entrypoints/viewer/main.tsx`

| Khối logic | Phạm vi dòng (StartLine -> EndLine) | Số dòng | Nội dung trách nhiệm chính |
|---|---|---|---|
| **Khối Toolbar (Viewer Toolbar)** | Dòng **1102 -> 1335** | **234 dòng** | Header, Sidebar toggle, Logo Brand, Tiêu đề docTitle, Segmented view mode (Song ngữ, Bản dịch, Bản gốc), Nút 50:50 reset, Mode selector dropdown (Vision AI / Whiteboard), Page navigator counter & jump, Nút Dịch lại, Nút mở Cài đặt |
| **Khối Modal Cài đặt (Settings Modal)** | Dòng **1337 -> 1863** | **527 dòng** | Modal 2 cột phong cách Modern IDE, Sidebar nav chuyển 3 tab (Giao diện & Đọc, Mô hình AI & API, Hiệu năng & Bộ nhớ), Topbar với badge auto-save 0ms, Nút đóng Esc |
| *Khối phụ: Post-Save Action Modal* | Dòng **1866 -> 1944** | **79 dòng** | Popup hỏi lựa chọn dịch lại trang hiện tại / toàn bộ / tiếp tục đọc sau khi lưu API key |
| *Khối phụ: API Key Warning Banner* | Dòng **1947 -> 1972** | **26 dòng** | Banner cảnh báo màu vàng khi chưa có API key nào được cấu hình cho provider hiện tại |

---

### 1.2. Khảo sát chi tiết Khối Thanh Công Cụ (Viewer Toolbar & Mode Selectors)

#### A. Cấu trúc DOM và phân chia dòng nội bộ
- **Container Header**: `header.lt-toolbar` (dòng 1103 -> 1335)
  1. **Nhóm Bên trái (Brand Group)**: Dòng 1105 -> 1130 (26 dòng)
     - Dòng 1106-1115: `<button class="lt-sidebar-toggle-btn">` - Bật/tắt Drawer danh sách trang (`setSidebarOpen((v) => !v)`).
     - Dòng 1116-1126: `<div class="lt-brand">` - Logo icon SVG và chữ thương hiệu `Live-Trans`.
     - Dòng 1127-1129: `<span class="lt-doc-title">` - Hiển thị `docTitle` (có tooltip `title={docTitle}`).
  2. **Nhóm Ở giữa (Center Group - View & Mode Controls)**: Dòng 1133 -> 1308 (176 dòng)
     - Dòng 1135-1169: `<div class="lt-segmented-group">` - 3 nút segmented chuyển đổi `viewMode`:
       - `bilingual` (Song ngữ đối chiếu, icon chia đôi)
       - `translated` (Chỉ bản dịch, icon tài liệu dịch)
       - `original` (Chỉ bản gốc, icon văn bản gốc)
     - Dòng 1172-1188: Nút đặt lại tỉ lệ chia đều `50:50` (chỉ hiển thị khi `viewMode === 'bilingual'`). Reset `setSplitRatio(0.5)`, `setLeftZoomFactor(1.0)`, `setRightZoomFactor(1.0)`.
     - Dòng 1191-1280: Mode Selector Dropdown (`.lt-dropdown-container`):
       - Trigger button (dòng 1192-1221): Hiển thị icon và nhãn của `readerMode` (`whiteboard` hiển thị "Bảng trắng", `vision` hiển thị "Vision AI" màu tím `#c084fc`).
       - Dropdown menu (dòng 1223-1279):
         - Item 1: `vision` - "Vision AI (Thị giác Đa phương thức) (Khuyên dùng)" (active khi `readerMode === 'vision'`).
         - Item 2: `whiteboard` - "Bảng trắng Component (Chưa hoàn thiện)" (active khi `readerMode === 'whiteboard'`).
         - Item 3: `markdown` - "Markdown Dòng chảy (Chưa phát triển)" (class `lt-disabled`).
         - Item 4: `overlay` - "Overlay Đè chữ (Chưa phát triển)" (class `lt-disabled`).
     - Dòng 1282-1307: Page Navigator (`.lt-page-counter`):
       - Nút Prev: `disabled={currentPage <= 1}`, `onClick={() => scrollToPage(currentPage - 1)}`.
       - Nhãn trang: `{currentPage} / {numPages}`.
       - Nút Next: `disabled={currentPage >= numPages}`, `onClick={() => scrollToPage(currentPage + 1)}`.
  3. **Nhóm Bên phải (Right Actions Group)**: Dòng 1311 -> 1334 (24 dòng)
     - Dòng 1312-1322: Nút "Dịch lại" (`onClick={retranslateAll}`) - Xóa cache + kích hoạt dịch lại toàn bộ.
     - Dòng 1324-1333: Nút Gear Cài đặt (`onClick={() => setIsSettingsOpen(true)}`).

#### B. State, Ref, Handlers phụ thuộc của Toolbar
- **State đầu vào**:
  - `sidebarOpen` (`boolean`, dòng 47)
  - `docTitle` (`string`, dòng 38)
  - `viewMode` (`ViewMode`, dòng 46)
  - `readerMode` (`'whiteboard' | 'vision' | 'markdown' | 'overlay'`, dòng 51)
  - `isModeMenuOpen` (`boolean`, dòng 52)
  - `currentPage` (`number`, dòng 41)
  - `numPages` (`number`, dòng 40)
- **Handlers / Callbacks**:
  - `setSidebarOpen: (v: boolean | ((prev: boolean) => boolean)) => void`
  - `setViewMode: (mode: ViewMode) => void`
  - `setSplitRatio: (ratio: number) => void`
  - `setLeftZoomFactor: (zoom: number) => void`
  - `setRightZoomFactor: (zoom: number) => void`
  - `setReaderMode: (mode: ReaderMode) => void`
  - `setIsModeMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void`
  - `scrollToPage: (page: number) => void` (dòng 1063-1076)
  - `retranslateAll: () => void` (dòng 1022-1060)
  - `setIsSettingsOpen: (open: boolean) => void` (dòng 69)

---

### 1.3. Khảo sát chi tiết Khối Modal Cài đặt (Settings Modal & Tab Panes)

#### A. Cấu trúc DOM và phân chia dòng nội bộ
- **Modal Shell**: Dòng 1338 -> 1863 (527 dòng)
  - Dòng 1339: Backdrop `<div class="lt-modal-backdrop" onClick={() => setIsSettingsOpen(false)}>`
  - Dòng 1340: Card `<div class="lt-modal-card-modern" onClick={(e) => e.stopPropagation()}>`
  
- **Sidebar Điều hướng Bên trái**: Dòng 1342 -> 1400 (59 dòng)
  - Dòng 1343-1349: Sidebar Header với icon gear và tiêu đề "Cài đặt Live-Trans".
  - Dòng 1351-1391: `<nav class="lt-sidebar-nav">` gồm 3 mục chuyển tab:
    - Tab `appearance`: "Giao diện & Đọc" (icon bảng màu palette)
    - Tab `models`: "Mô hình AI & API" (icon robot/cpu)
    - Tab `performance`: "Hiệu năng & Bộ nhớ" (icon tia sét bolt)
  - Dòng 1393-1398: Footer hiển thị version: `Live-Trans v1.1.1` - `Tối ưu cho Paper PDF`.

- **Main Content Topbar**: Dòng 1404 -> 1432 (29 dòng)
  - Dòng 1405-1409: Tiêu đề động theo tab đang chọn:
    - `appearance` -> `🎨 Tùy chỉnh Giao diện & Đọc`
    - `models` -> `🤖 Cấu hình Mô hình AI & Đa Khóa API`
    - `performance` -> `⚡ Hiệu năng Dịch & Quản lý Bộ nhớ`
  - Dòng 1412-1419: Auto-save badge (`showAutoSaveBadge && <span class="lt-autosave-badge">Đã tự động lưu</span>`).
  - Dòng 1420-1430: Nút đóng modal (`onClick={() => setIsSettingsOpen(false)}`, phím tắt Esc).

- **Tab 1: Giao diện & Đọc (`AppearanceTab`)**: Dòng 1436 -> 1635 (200 dòng)
  - Cấu trúc 2 cột song song (`.lt-appearance-split-layout`):
    - **Cột trái - Controls (`.lt-appearance-controls-col`)**: Dòng 1439 -> 1563 (125 dòng)
      1. *Card Chủ đề & Màu nền (Theme)*: Dòng 1441-1469
         - 5 themes: `white` (Trắng), `sepia` (Giấy ngà), `dark` (Tối êm), `midnight` (Đêm đen), `oceanic` (Biển sâu).
         - Active state: `(settings.viewerTheme || 'white') === t.id`.
         - Handler: `updateSettingDirect('viewerTheme', t.id)`.
         - Thẻ preview gồm 3 dòng skeleton line trực quan.
      2. *Card Font chữ bản dịch (Font Family)*: Dòng 1472-1515
         - Sử dụng `CustomSelect` component (dòng 1477-1514).
         - 5 options: `system` (Sans-serif Mặc định), `times` (Times New Roman Serif học thuật), `palatino` (Palatino Linotype cổ điển), `segoe` (Segoe UI mượt mà), `arial` (Arial Clean).
         - Handler: `updateSettingDirect('viewerFontFamily', val)`.
      3. *Card Tỷ lệ thu phóng bản dịch (Content Scale)*: Dòng 1518-1562
         - Quick pills: `[85, 90, 100, 115, 130, 150, 175]`. Active: `(settings.viewerFontScale || 100) === scale`. Click cập nhật đồng thời `viewerFontScale` và `viewerFontSize = Math.round(15 * (scale / 100))`.
         - Slider kéo trực tiếp (`<input type="range" min="75" max="180">`) kèm nhãn số phần trăm % trực tiếp.
    - **Cột phải - Live Document Preview (`.lt-appearance-preview-col`)**: Dòng 1566 -> 1634 (69 dòng)
      - Header "Xem trước trực tiếp" kèm tag "⚡ 0ms Real-time".
      - Giấy mô phỏng `.lt-live-preview-paper-sheet` với class động `lt-preview-theme-${settings.viewerTheme || 'white'}` và style `zoom: scale / 100`, `fontFamily: ...`.
      - Nội dung bài báo mẫu học thuật (Title, Meta tác giả CVPR, Abstract, Công thức toán học gradient $\nabla_x \log p_t(x)$, Bảng số liệu so sánh Baseline vs Proposed).

- **Tab 2: Mô hình AI & API (`ModelsTab`)**: Dòng 1638 -> 1787 (150 dòng)
  - Card 1: *Nhà cung cấp & Mô hình AI (Provider & Model)*: Dòng 1641-1684 (44 dòng)
    - Dropdown Provider: `CustomSelect` (`gemini` - Google Gemini hoặc `zen` - OpenCode Zen). Khi đổi provider, tự động chọn default model tương ứng (`DEFAULT_PDF_MODEL[p]`), lưu settings và kích hoạt auto-save badge.
    - Dropdown Model: `CustomSelect` nạp danh sách `PDF_GEMINI_MODELS` hoặc `PDF_ZEN_MODELS`. Model `gemini-3.5-flash-lite` có tag khuyên dùng.
  - Card 2: *Quản lý Đa API Key & Smart Router*: Dòng 1687-1785 (99 dòng)
    - Badge đếm số key theo provider hiện tại: `{modalProviderKeys.length} key Gemini/Zen`.
    - Dòng thêm key mới (`.lt-add-key-row`): Dropdown chọn provider, ô input password (placeholder theo provider, hỗ trợ Enter), nút "Thêm" gọi `handleAddKey()`.
    - Danh sách key (`.lt-keys-list`): Mỗi key hiển thị badge provider, masked key (`maskApiKey(item.key)`), tag "Mặc định" cho key đầu tiên, nút xóa gọi `handleRemoveKey(item.id)`.
    - Ghi chú trạng thái Smart Router (`.lt-router-status-note`):
      - $\ge 2$ keys: 🟢 Kích hoạt Smart Router xoay vòng khi chạm 429.
      - $1$ key: ℹ️ Chế độ 1 key đơn lẻ.
      - $0$ key: ⚠️ Cảnh báo chưa có API key.

- **Tab 3: Hiệu năng & Bộ nhớ (`PerformanceTab`)**: Dòng 1790 -> 1858 (69 dòng)
  - Card 1: *Số trang dịch song song (Multi-Worker Concurrency)*: Dòng 1793-1810 (18 dòng)
    - `CustomSelect` chọn từ 2 đến 7 luồng (mặc định 5). Cập nhật `settings.pdfConcurrency`.
  - Card 2: *Ngôn ngữ đích (Target Language)*: Dòng 1813-1831 (19 dòng)
    - `CustomSelect` chọn: vi, en, ja, zh, ko, fr, de. Cập nhật `settings.targetLang`.
  - Card 3: *Bộ nhớ đệm thông minh (LRU Cache) & Dịch lại*: Dòng 1834-1856 (23 dòng)
    - Nút "↻ Xóa cache & Dịch lại toàn bộ các trang" -> gọi `retranslateAll()` và đóng modal `setIsSettingsOpen(false)`.

- **Khối phụ: Post-Save Action Modal (`PostSaveActionModal`)**: Dòng 1866 -> 1944 (79 dòng)
  - Modal thông báo khi vừa lưu API key thành công. Cung cấp 3 lựa chọn hành động:
    1. "Dịch lại Trang hiện tại (Trang X)": Gọi `retryVisionPage(currentPage)`.
    2. "Dịch lại Toàn bộ tài liệu": Gọi `retranslateAll()`.
    3. "Để sau (tiếp tục đọc bình thường)": Gọi `processVisionQueue()`.

- **Khối phụ: API Key Warning Banner (`ApiKeyWarningBanner`)**: Dòng 1947 -> 1972 (26 dòng)
  - Hiển thị thanh banner màu vàng ở đỉnh viewer khi `!hasActiveKey`.
  - Nút "Cấu hình API Key" mở Settings Modal (`setIsSettingsOpen(true)`).

---

## 2. LOGIC CHAIN (Suy luận kỹ thuật & Lộ trình phân rã)

### 2.1. Đánh giá hiện trạng
1. File `viewer/main.tsx` hiện có **2,429 dòng**, trong đó 2 khối Settings Modal và Toolbar chiếm tới **~866 dòng** (hơn 35% toàn bộ file).
2. Việc để toàn bộ JSX modal cài đặt (3 tabs, theme preview paper, danh sách API key, dropdowns) và toolbar bên trong component cha `ViewerApp` dẫn đến:
   - Component cha quá cồng kềnh, vi phạm Single Responsibility Principle (SRP).
   - Bất kỳ thay đổi nhỏ nào ở UI Settings hay Toolbar đều khiến toàn bộ component cha re-evaluate JSX tree.
   - Khó viết unit test độc lập cho từng tab cài đặt và toolbar.

### 2.2. Mục tiêu phân rã
- Tách toàn bộ UI và logic tương ứng của 2 khối này thành các sub-components độc lập đặt trong thư mục `extension/entrypoints/viewer/components/`.
- Đảm bảo quy tắc kiến trúc nghiêm ngặt: **Mọi file mới tạo ra đều < 400 dòng** (trong thiết kế dưới đây, file lớn nhất chỉ 210 dòng).
- Giữ nguyên 100% contracts, props, behavior và styling CSS hiện có, không làm gãy 161 unit tests hiện hành.

### 2.3. Sơ đồ cây thư mục đề xuất sau khi phân rã

```
extension/entrypoints/viewer/
├── components/
│   ├── SettingsModal/
│   │   ├── types.ts                    (~50 dòng: Type definitions & Props contracts)
│   │   ├── SettingsModal.tsx           (~130 dòng: Modal shell, Sidebar nav, Topbar, Tabs switch)
│   │   ├── AppearanceTab.tsx           (~210 dòng: Themes grid, Font CustomSelect, Scale & Live Preview)
│   │   ├── ModelsTab.tsx               (~160 dòng: Provider & Model select, Multi-key management, Smart Router note)
│   │   ├── PerformanceTab.tsx          (~90 dòng: Concurrency, Target Language, LRU Cache clear)
│   │   ├── PostSaveActionModal.tsx     (~85 dòng: Popup lựa chọn dịch lại sau khi lưu key)
│   │   └── ApiKeyWarningBanner.tsx     (~35 dòng: Banner vàng cảnh báo thiếu API key)
│   └── Toolbar/
│       ├── types.ts                    (~45 dòng: Type definitions & Props contracts)
│       ├── ViewerToolbar.tsx           (~160 dòng: Header container, Brand group, Center group, Right actions)
│       ├── ModeSelectorDropdown.tsx    (~85 dòng: Dropdown menu chọn Vision AI / Whiteboard / Markdown)
│       └── PageNavigator.tsx           (~45 dòng: Page counter & Jump navigation)
├── CustomSelect.tsx                    (158 dòng - Giữ nguyên)
├── PdfSnippet.tsx                      (60 dòng - Giữ nguyên)
├── VisionPageRenderer.tsx              (299 dòng - Giữ nguyên)
├── WhiteboardPageRenderer.tsx          (310 dòng - Giữ nguyên)
├── main.tsx                            (Giảm từ 2,429 -> ~1,560 dòng trong Phase 1)
└── style.css                           (1,743 dòng - Giữ nguyên)
```

---

## 3. THIẾT KẾ INTERFACES & PROPS CONTRACTS CHI TIẾT

### 3.1. Phân hệ Settings Modal (`components/SettingsModal/types.ts`)

```typescript
import type { Settings, PdfProvider, ApiKeyItem } from '@/lib/settings';

export type SettingsTab = 'appearance' | 'models' | 'performance';

export interface AppearanceTabProps {
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export interface ModelsTabProps {
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onSetSettings: (settings: Settings | ((prev: Settings) => Settings)) => void;
  keyItems: ApiKeyItem[];
  modalProviderKeys: ApiKeyItem[];
  newKeyProvider: PdfProvider;
  onSetNewKeyProvider: (provider: PdfProvider) => void;
  newKeyText: string;
  onSetNewKeyText: (text: string) => void;
  onAddKey: () => void;
  onRemoveKey: (id: string) => void;
  triggerAutoSaveBadge: () => void;
}

export interface PerformanceTabProps {
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onRetranslateAll: () => void;
  onCloseModal: () => void;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettingDirect: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onSetSettings: (settings: Settings | ((prev: Settings) => Settings)) => void;
  keyItems: ApiKeyItem[];
  modalProviderKeys: ApiKeyItem[];
  newKeyProvider: PdfProvider;
  onSetNewKeyProvider: (provider: PdfProvider) => void;
  newKeyText: string;
  onSetNewKeyText: (text: string) => void;
  onAddKey: () => void;
  onRemoveKey: (id: string) => void;
  onRetranslateAll: () => void;
  showAutoSaveBadge: boolean;
  triggerAutoSaveBadge: () => void;
}

export interface PostSaveActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  onRetryPage: (pageNumber: number) => void;
  onRetranslateAll: () => void;
  onContinueReading: () => void;
}

export interface ApiKeyWarningBannerProps {
  hasActiveKey: boolean;
  provider: PdfProvider;
  onOpenSettings: () => void;
}
```

### 3.2. Phân hệ Toolbar (`components/Toolbar/types.ts`)

```typescript
import type { ViewMode } from '@/lib/pdf/types';

export type ReaderMode = 'whiteboard' | 'vision' | 'markdown' | 'overlay';

export interface PageNavigatorProps {
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
}

export interface ModeSelectorDropdownProps {
  readerMode: ReaderMode;
  onChangeReaderMode: (mode: ReaderMode) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
}

export interface ViewerToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  docTitle: string;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onResetSplitRatio: () => void;
  readerMode: ReaderMode;
  onChangeReaderMode: (mode: ReaderMode) => void;
  isModeMenuOpen: boolean;
  onToggleModeMenu: () => void;
  onCloseModeMenu: () => void;
  currentPage: number;
  numPages: number;
  onPageChange: (page: number) => void;
  onRetranslateAll: () => void;
  onOpenSettings: () => void;
}
```

---

## 4. CAVEATS (Những điểm cần lưu ý đặc biệt khi thực hiện)

1. **Sự kiện phím Escape cho Modal Cài đặt**:
   - Hiện tại `main.tsx` đăng ký `window.addEventListener('keydown', onKeyDown)` tại dòng 91-100.
   - Khi tách thành `SettingsModal.tsx`, hook này nên được di chuyển hoàn toàn vào bên trong `SettingsModal.tsx` để component tự dọn dẹp listener khi unmount, giảm bớt 10 dòng và 1 `useEffect` tại component cha `ViewerApp`.
2. **Sự kiện Click Outside đóng Dropdown Mode Selector**:
   - Hiện tại `main.tsx` lắng nghe click outside tại dòng 196-204 (`!target?.closest('.lt-dropdown-container')`).
   - Có thể tích hợp hook đóng dropdown này vào `ModeSelectorDropdown.tsx` hoặc truyền `onClose` từ cha. Cần chú ý giữ nguyên selector `.lt-dropdown-container` để không bị xung đột.
3. **Đường dẫn import `CustomSelect`**:
   - `CustomSelect.tsx` hiện nằm cùng cấp với `main.tsx` (`extension/entrypoints/viewer/CustomSelect.tsx`).
   - Khi các tab nằm trong `components/SettingsModal/`, import tương đối sẽ là `../../CustomSelect` hoặc dùng path alias `@/entrypoints/viewer/CustomSelect`.
4. **Hàm `processVisionQueue` trong `PostSaveActionModal`**:
   - Khi bấm "Để sau (tiếp tục đọc bình thường)", hàm `processVisionQueue()` của worker engine trong `main.tsx` được kích hoạt. Props `onContinueReading` sẽ nhận hàm này dưới dạng callback.
5. **Hiệu năng Render của Cột Live Preview**:
   - Trong `AppearanceTab.tsx`, cột Live Preview phụ thuộc vào `settings.viewerTheme`, `settings.viewerFontScale`, `settings.viewerFontFamily`. Việc tách thành file riêng giúp Live Preview chỉ re-render khi các setting hiển thị thay đổi, không bị ảnh hưởng bởi tiến trình dịch ngầm của worker engine trong `ViewerApp`.

---

## 5. CONCLUSION (Kết luận & Đánh giá)

1. **Phân rã khả thi 100%**: Hai khối Settings Modal và Toolbar hoàn toàn là các UI controls và forms với luồng dữ liệu một chiều (props xuống, callback lên). Không có sự phụ thuộc vòng (circular dependency).
2. **Tuân thủ tuyệt đối giới hạn dòng**:
   - Tất cả 9 file mới đề xuất đều nằm trong khoảng **35 đến 210 dòng**, thấp hơn rất nhiều so với ngưỡng tối đa 400 dòng/file.
   - Giảm trực tiếp **~866 dòng mã nguồn** trong `main.tsx`, đưa dung lượng file này từ 2,429 dòng xuống ~1,560 dòng trong Phase 1.
3. **Bảo toàn chức năng (Zero-Regression)**:
   - Toàn bộ 5 theme, 5 font chữ tiếng Việt, Content scale slider, Multi-key router, Concurrency controls, Segmented view modes và Mode dropdowns đều được giữ nguyên 100% HTML classes và inline styles, đảm bảo tương thích tuyệt đối với `style.css` hiện có.

---

## 6. VERIFICATION METHOD (Phương pháp kiểm chứng độc lập)

Để kiểm chứng tính độc lập và toàn vẹn của thiết kế bóc tách:

1. **Kiểm tra kiểu dữ liệu tĩnh (TypeScript Compilation)**:
   ```powershell
   npm run check
   ```
   *Kỳ vọng*: Không có bất kỳ lỗi type error nào về Props, State hoặc Callbacks.

2. **Kiểm tra Unit Tests toàn dự án**:
   ```powershell
   npm run test
   ```
   *Kỳ vọng*: 161/161 unit tests hiện có vượt qua thành công 100%.

3. **Kiểm tra giới hạn số dòng file**:
   ```powershell
   Get-ChildItem -Recurse extension/entrypoints/viewer/components/*.tsx | ForEach-Object { "$($_.Name): $((Get-Content $_.FullName | Measure-Object -Line).Lines) lines" }
   ```
   *Kỳ vọng*: Mọi file đều có số dòng < 400 lines.
