# Node Trans

[English](README.en.md)

Ứng dụng dịch âm thanh thời gian thực sử dụng [Soniox API](https://soniox.com/docs/stt/rt/real-time-translation). Hỗ trợ nghe từ microphone, system audio hoặc cả hai, dịch sang ngôn ngữ đích và lưu lịch sử hội thoại.

Chạy trên **trình duyệt** (web) hoặc **ứng dụng desktop** (Electron). Hỗ trợ **macOS** và **Windows**.

## Yêu cầu

- **Node.js** >= 20
- **ffmpeg** (tự động tải khi build Electron, hoặc cài thủ công cho chế độ web)
- **Soniox API Key** (đăng ký tại [soniox.com](https://soniox.com))

### Cài ffmpeg (chế độ web)

| Hệ điều hành | Cách cài |
|---------------|----------|
| macOS | `brew install ffmpeg` |
| Windows | `winget install ffmpeg` hoặc tải từ [ffmpeg.org](https://ffmpeg.org/download.html), thêm vào PATH |

## Cài đặt

```bash
# Clone và cài dependencies
npm install

# Build frontend
npm run build
```

## Chạy

### Chế độ Web (trình duyệt)

```bash
# Production
npm start

# Development (chạy server + client đồng thời)
npm run dev
```

- Production: mở `http://localhost:3000`
- Development: mở `http://localhost:5173` (Vite dev server, tự proxy API)

### Chế độ Electron (desktop app)

```bash
# Development
npm run electron:dev

# Build app
npm run electron:build          # Build cho platform hiện tại
npm run electron:build:mac      # Build cho macOS
npm run electron:build:win      # Build cho Windows
```

## Cấu hình API Key

Có 2 cách cấu hình Soniox API Key:

1. **Trong app** — vào tab **Settings** → nhập API key vào ô **Soniox API Key**
2. **File `.env`** — tạo file `.env` ở thư mục gốc:
   ```
   SONIOX_API_KEY=your_api_key_here
   ```

API key cài trong Settings sẽ được ưu tiên hơn `.env`.

## Capture System Audio

Để capture âm thanh hệ thống (Google Meet, Zoom, YouTube, v.v.), máy tính cần một **virtual audio driver** — thiết bị âm thanh ảo hoạt động như một "dây nối" giữa loa và microphone, cho phép app nghe được âm thanh đang phát ra.

> **Tại sao cần?** Mặc định, hệ điều hành không cho phép app trực tiếp "nghe trộm" output âm thanh. Virtual driver tạo ra một thiết bị trung gian: bạn chuyển output sang thiết bị ảo đó, và app đọc input từ cùng thiết bị đó.

---

### macOS — BlackHole

**BlackHole** là virtual audio driver miễn phí, phổ biến nhất trên macOS.

#### Bước 1 — Cài BlackHole

**Cách A: Homebrew (khuyên dùng)**
```bash
brew install blackhole-2ch
```

**Cách B: Tải trực tiếp**
- Vào [existential.audio/blackhole](https://existential.audio/blackhole/) → chọn **BlackHole 2ch** → điền email → tải file `.pkg` → chạy installer

Sau khi cài xong, **restart máy** để driver được load.

#### Bước 2 — Kiểm tra cài thành công

1. Mở **System Settings → Sound**
2. Ở tab **Output** và **Input**, bạn sẽ thấy **BlackHole 2ch** trong danh sách
3. Nếu chưa thấy → restart lại máy

#### Bước 3 — Tạo Aggregate Device (để nghe + capture cùng lúc)

> Bước này quan trọng: nếu chỉ chọn BlackHole làm output thì loa sẽ bị tắt tiếng. Aggregate Device giúp âm thanh ra loa **đồng thời** được capture vào app.

1. Mở **Audio MIDI Setup**
   - Spotlight (⌘ Space) → gõ "Audio MIDI Setup" → Enter
   - Hoặc: `/Applications/Utilities/Audio MIDI Setup.app`

2. Nhấn **"+"** ở góc dưới bên trái → chọn **Create Aggregate Device**

3. Trong danh sách bên phải, **tick chọn cả hai**:
   - ✅ **BlackHole 2ch**
   - ✅ **Loa đang dùng** (ví dụ: "MacBook Pro Speakers", "External Headphones")

4. Đặt tên dễ nhớ, ví dụ: **"Node Trans Aggregate"**
   - Double-click vào tên "Aggregate Device" ở cột trái để đổi tên

5. Đảm bảo **clock source** được set vào loa chính (không phải BlackHole) để tránh tiếng lạch cạch

#### Bước 4 — Đặt Aggregate Device làm Output mặc định

1. Vào **System Settings → Sound → Output**
2. Chọn **"Node Trans Aggregate"** (hoặc tên bạn đặt ở bước 3)
3. Từ lúc này, âm thanh sẽ ra loa bình thường và BlackHole sẽ capture đồng thời

#### Bước 5 — Cấu hình trong app

1. Vào tab **Settings** trong Node Trans
2. **Audio Source** → chọn **"System Audio"** hoặc **"Both"** (nếu muốn dịch cả micro lẫn hệ thống)
3. **System Audio Device** → chọn **"BlackHole 2ch"**
4. Nhấn **Start** → app sẽ bắt đầu dịch âm thanh từ hệ thống

> **Lưu ý khi dùng xong:** Nhớ chuyển Output về loa gốc (MacBook Pro Speakers) trong System Settings → Sound, vì Aggregate Device đôi khi gây delay nhỏ.

#### Xử lý sự cố

| Vấn đề | Giải pháp |
|--------|-----------|
| Không thấy BlackHole trong danh sách | Restart máy, nếu vẫn không thấy thì cài lại |
| Âm thanh bị delay/echo | Trong Audio MIDI Setup, đặt Clock Source = loa chính |
| App không detect BlackHole | Khởi động lại app, kiểm tra System Audio Device đã chọn đúng chưa |
| Mất âm thanh sau khi cài | Kiểm tra Output trong System Settings → Sound, chọn lại Aggregate Device |

---

### Windows — VB-CABLE

**VB-CABLE** là virtual audio driver miễn phí trên Windows, tạo ra một cặp thiết bị: **CABLE Input** (output ảo) và **CABLE Output** (input ảo).

#### Bước 1 — Tải và cài VB-CABLE

1. Vào [vb-audio.com/Cable](https://vb-audio.com/Cable/)
2. Kéo xuống phần **"Download VB-CABLE Driver"** → nhấn tải
3. Giải nén file `.zip` → chạy **`VBCABLE_Setup_x64.exe`** (64-bit) với quyền **Administrator**
   - Chuột phải → **Run as administrator**
4. Nhấn **"Install Driver"** → chờ cài xong
5. **Restart máy** — bắt buộc để driver hoạt động

#### Bước 2 — Kiểm tra cài thành công

1. Chuột phải vào icon loa ở taskbar → **Sound settings** (hoặc **Open Sound settings**)
2. Ở phần **Output**, bạn sẽ thấy **"CABLE Input (VB-Audio Virtual Cable)"**
3. Ở phần **Input**, bạn sẽ thấy **"CABLE Output (VB-Audio Virtual Cable)"**

#### Bước 3 — Chuyển Output sang CABLE Input

1. Vào **Settings → System → Sound** (hoặc chuột phải vào icon loa → Open Sound settings)
2. Ở phần **Output** → chọn **"CABLE Input (VB-Audio Virtual Cable)"**

> ⚠️ Sau bước này, loa sẽ **bị tắt tiếng** vì âm thanh đang đi vào CABLE. Xem Bước 4 để nghe lại.

#### Bước 4 — Bật "Listen to this device" để nghe loa đồng thời (tuỳ chọn)

Nếu bạn muốn vừa nghe loa vừa để app capture:

1. Chuột phải icon loa → **Sounds** → tab **Recording**
2. Double-click vào **"CABLE Output (VB-Audio Virtual Cable)"**
3. Tab **Listen** → tick **"Listen to this device"**
4. **Playback through this device** → chọn loa thật của bạn (ví dụ: Speakers / Headphones)
5. OK → Apply

#### Bước 5 — Cấu hình trong app

1. Vào tab **Settings** trong Node Trans
2. **Audio Source** → chọn **"System Audio"** hoặc **"Both"**
3. **System Audio Device** → chọn **"CABLE Output (VB-Audio Virtual Cable)"**
4. Nhấn **Start**

#### Phương án thay thế — Stereo Mix (không cần cài phần mềm)

Một số máy Windows có tính năng **Stereo Mix** sẵn (thường có trên mainboard với Realtek audio):

1. Chuột phải icon loa → **Sounds** → tab **Recording**
2. Chuột phải vào vùng trống → chọn **"Show Disabled Devices"**
3. Nếu thấy **Stereo Mix** → chuột phải → **Enable**
4. Trong app, chọn **Stereo Mix** làm System Audio Device

> Stereo Mix không cần Bước 3 (không phải đổi Output), nhưng chất lượng capture đôi khi kém hơn VB-CABLE.

#### Xử lý sự cố

| Vấn đề | Giải pháp |
|--------|-----------|
| Không thấy CABLE sau khi cài | Restart máy, kiểm tra đã Run as Administrator chưa |
| Âm thanh mất sau khi chọn CABLE Output | Bật "Listen to this device" theo Bước 4 |
| App không thấy CABLE Output trong dropdown | Khởi động lại app, kiểm tra driver đã cài đúng chưa |
| Tiếng bị trễ (latency) | Vào VB-CABLE Control Panel → tăng buffer size |

## Sử dụng

### Giao diện chính

Giao diện gồm **Live tab** để dịch trực tiếp và **Sidebar** bên trái hiển thị danh sách sessions. App hỗ trợ đa ngôn ngữ (English / Tiếng Việt), chuyển đổi trong Settings.

### Tab Dịch trực tiếp

- Nhấn **▶ Start** để bắt đầu nghe và dịch
- **⏸ Pause** — tạm dừng capture, giữ nguyên session
- **▶ Resume** — tiếp tục capture trong cùng session
- **⊕ New Meeting** — kết thúc session hiện tại, bắt đầu session mới
- **⏹ Stop** — kết thúc session
- **Resume Session** — mở lại session đã kết thúc và tiếp tục ghi

Mỗi speaker được phân biệt bằng màu sắc riêng. Nội dung gốc và bản dịch hiển thị realtime.

### Sidebar Sessions

- Danh sách các session đã lưu, hiển thị thời gian, thời lượng, nguồn, số câu
- **Click** vào session để xem chi tiết transcript
- Chế độ chọn nhiều để xóa hàng loạt
- **Đổi tên session** và **đổi tên speaker** (ví dụ "Speaker 1" → "Anh Nam")
- **Export Markdown** để lưu nội dung ra file `.md`

### Tab Settings

| Cài đặt | Mô tả |
|---------|-------|
| Soniox API Key | API key để sử dụng dịch vụ Soniox |
| Audio Source | Microphone / System Audio / Both |
| Microphone Device | Chọn microphone (từ danh sách input devices) |
| System Audio Device | Chọn device để capture system audio. Hiện khi chọn System Audio hoặc Both |
| Target Language | Ngôn ngữ dịch chung (mặc định: Tiếng Việt) |
| Mic Target Language | Ngôn ngữ dịch riêng cho microphone (khi dùng Both) |
| System Target Language | Ngôn ngữ dịch riêng cho system audio (khi dùng Both) |
| UI Language | Ngôn ngữ giao diện (English / Tiếng Việt) |

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4, Socket.IO Client |
| Backend | Node.js, Express 5, Socket.IO |
| Desktop | Electron |
| Audio | ffmpeg (avfoundation trên macOS, dshow trên Windows) |
| Speech-to-Text | Soniox API (realtime translation) |
| Database | SQLite (better-sqlite3) |

## Cấu trúc project

```
node-trans/
├── client/                # React frontend (Vite + Tailwind CSS)
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── style.css
│       ├── hooks/         # useTheme
│       ├── context/       # SocketContext (useReducer)
│       ├── i18n/          # Đa ngôn ngữ (I18nContext, locales)
│       ├── components/    # Header, TabNav, StatusBar, Modal, Sidebar
│       │   ├── live/      # Controls, Transcript, Utterance
│       │   ├── history/   # SpeakerList
│       │   └── settings/  # SettingsTab
│       └── utils/         # api.js, constants.js, speakerColors.js
├── electron/              # Electron main process
│   ├── main.js            # Electron entry point
│   └── preload.js         # Preload script
├── scripts/
│   └── download-ffmpeg.js # Tải ffmpeg binary cho Electron build
├── build/                 # Build resources (entitlements, icons)
├── src/
│   ├── server.js          # Express + Socket.IO server
│   ├── audio/
│   │   ├── capture.js     # ffmpeg audio capture (macOS + Windows)
│   │   └── devices.js     # Liệt kê input/output devices (macOS + Windows)
│   ├── soniox/
│   │   └── session.js     # Soniox realtime translation session
│   ├── storage/
│   │   ├── history.js     # SQLite DB (sessions, utterances, speaker aliases)
│   │   ├── settings.js    # Settings (~/.node-trans/settings.json)
│   │   └── export.js      # Xuất session ra Markdown
│   └── routes/
│       └── api.js         # REST API endpoints
├── electron-builder.config.js  # Cấu hình Electron Builder
├── dist/                  # Build output (generated by `npm run build`)
└── package.json
```

## Dữ liệu

Dữ liệu được lưu tại `~/.node-trans/` (hoặc thư mục userData của Electron):

- `settings.json` — cài đặt ứng dụng
- `history.db` — SQLite database chứa lịch sử hội thoại

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/devices` | Danh sách audio devices |
| GET | `/api/settings` | Đọc settings |
| PUT | `/api/settings` | Lưu settings |
| GET | `/api/sessions` | Danh sách sessions (hỗ trợ `limit`, `offset`) |
| GET | `/api/sessions/:id` | Chi tiết session + utterances |
| PATCH | `/api/sessions/:id` | Đổi tên session |
| DELETE | `/api/sessions/:id` | Xóa session |
| PUT | `/api/sessions/:id/speakers/:speaker` | Đổi tên speaker |
| GET | `/api/sessions/:id/export` | Xuất Markdown |

## Socket.IO Events

| Event (Client → Server) | Mô tả |
|--------------------------|-------|
| `start-listening` | Bắt đầu capture + dịch (hỗ trợ `sessionId` để resume) |
| `pause-listening` | Tạm dừng |
| `resume-listening` | Tiếp tục |
| `stop-listening` | Dừng |

| Event (Server → Client) | Mô tả |
|--------------------------|-------|
| `status` | Trạng thái (listening, paused, sessionId, audioSource) |
| `utterance` | Câu hoàn chỉnh (source, original + translation) |
| `partial-result` | Kết quả tạm thời |
| `error` | Lỗi |
