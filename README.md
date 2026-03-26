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

Nếu muốn capture âm thanh hệ thống (ví dụ: nghe cuộc họp trên Google Meet, Zoom...), cần cài thêm virtual audio driver.

### macOS — BlackHole

```bash
brew install blackhole-2ch
# Restart máy sau khi cài
```

Sau khi cài BlackHole, tạo **Aggregate Device** trong Audio MIDI Setup:

1. Mở **Audio MIDI Setup** (Spotlight → "Audio MIDI Setup")
2. Nhấn **"+"** ở góc trái dưới → **Create Aggregate Device**
3. Tick **BlackHole 2ch** + **loa đang dùng** (ví dụ MacBook Pro Speakers)
4. Vào **System Settings → Sound → Output** → chọn Aggregate Device vừa tạo

App tự detect BlackHole để capture.

### Windows — VB-CABLE

1. Tải **VB-CABLE** (free) từ [vb-audio.com/Cable](https://vb-audio.com/Cable/)
2. Cài đặt và restart máy
3. Vào **Sound Settings → Output** → chọn **CABLE Input** làm output
4. Trong app, vào **Settings** → **Audio Source** chọn "System Audio" hoặc "Both"
5. Chọn **CABLE Output (VB-Audio Virtual Cable)** trong dropdown **System Audio Device**

Hoặc enable **Stereo Mix** trong Sound Settings (nếu sound card hỗ trợ):
- Vào **Sound Settings → Recording** → chuột phải → **Show Disabled Devices** → enable **Stereo Mix**
- Trong app, chọn Stereo Mix làm System Audio Device

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
