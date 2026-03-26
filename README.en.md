# Node Trans

[Tiếng Việt](README.md)

Real-time audio translation app powered by the [Soniox API](https://soniox.com/docs/stt/rt/real-time-translation). Captures audio from microphone, system audio, or both, translates to a target language, and saves conversation history.

Runs in the **browser** (web) or as a **desktop app** (Electron). Supports **macOS** and **Windows**.

## Requirements

- **Node.js** >= 20
- **ffmpeg** (auto-downloaded when building Electron, or install manually for web mode)
- **Soniox API Key** (sign up at [soniox.com](https://soniox.com))

### Install ffmpeg (web mode)

| OS | Command |
|----|---------|
| macOS | `brew install ffmpeg` |
| Windows | `winget install ffmpeg` or download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH |

## Installation

```bash
# Install dependencies
npm install

# Build frontend
npm run build
```

## Running

### Web Mode (browser)

```bash
# Production
npm start

# Development (run server + client concurrently)
npm run dev
```

- Production: open `http://localhost:3000`
- Development: open `http://localhost:5173` (Vite dev server, proxies API automatically)

### Electron Mode (desktop app)

```bash
# Development
npm run electron:dev

# Build app
npm run electron:build          # Build for current platform
npm run electron:build:mac      # Build for macOS
npm run electron:build:win      # Build for Windows
```

## API Key Configuration

Two ways to configure the Soniox API Key:

1. **In the app** — go to **Settings** tab → enter API key in the **Soniox API Key** field
2. **`.env` file** — create a `.env` file in the project root:
   ```
   SONIOX_API_KEY=your_api_key_here
   ```

API key set in Settings takes priority over `.env`.

## System Audio Capture

To capture system audio (e.g. Google Meet, Zoom calls), you need a virtual audio driver.

### macOS — BlackHole

```bash
brew install blackhole-2ch
# Restart after installation
```

After installing BlackHole, create an **Aggregate Device** in Audio MIDI Setup:

1. Open **Audio MIDI Setup** (Spotlight → "Audio MIDI Setup")
2. Click **"+"** at the bottom left → **Create Aggregate Device**
3. Check **BlackHole 2ch** + **your speaker** (e.g. MacBook Pro Speakers)
4. Go to **System Settings → Sound → Output** → select the Aggregate Device

The app auto-detects BlackHole for capture.

### Windows — VB-CABLE

1. Download **VB-CABLE** (free) from [vb-audio.com/Cable](https://vb-audio.com/Cable/)
2. Install and restart your computer
3. Go to **Sound Settings → Output** → select **CABLE Input** as output device
4. In the app, go to **Settings** → set **Audio Source** to "System Audio" or "Both"
5. Select **CABLE Output (VB-Audio Virtual Cable)** in the **System Audio Device** dropdown

Alternatively, enable **Stereo Mix** in Sound Settings (if your sound card supports it):
- Go to **Sound Settings → Recording** → right-click → **Show Disabled Devices** → enable **Stereo Mix**
- In the app, select Stereo Mix as the System Audio Device

## Usage

### Interface

The interface consists of a **Live tab** for real-time translation and a **Sidebar** on the left showing session history. The app supports multiple UI languages (English / Vietnamese), configurable in Settings.

### Live Translation Tab

- Press **▶ Start** to begin listening and translating
- **⏸ Pause** — pause capture while keeping the session
- **▶ Resume** — continue capture in the same session
- **⊕ New Meeting** — end current session and start a new one
- **⏹ Stop** — end the session
- **Resume Session** — reopen a finished session and continue recording

Each speaker is distinguished by a unique color. Original text and translations are displayed in real-time.

### Sessions Sidebar

- Lists all saved sessions with timestamps, duration, source, and utterance count
- **Click** a session to view the detailed transcript
- Multi-select mode for bulk deletion
- **Rename sessions** and **rename speakers** (e.g. "Speaker 1" → "John")
- **Export to Markdown** to save the conversation as a `.md` file

### Settings Tab

| Setting | Description |
|---------|-------------|
| Soniox API Key | API key for Soniox speech service |
| Audio Source | Microphone / System Audio / Both |
| Microphone Device | Select microphone (from input device list) |
| System Audio Device | Select device for system audio capture. Shown when Audio Source is System Audio or Both |
| Target Language | Translation language (default: Vietnamese) |
| Mic Target Language | Per-source translation language for microphone (when using Both) |
| System Target Language | Per-source translation language for system audio (when using Both) |
| UI Language | Interface language (English / Vietnamese) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4, Socket.IO Client |
| Backend | Node.js, Express 5, Socket.IO |
| Desktop | Electron |
| Audio | ffmpeg (avfoundation on macOS, dshow on Windows) |
| Speech-to-Text | Soniox API (realtime translation) |
| Database | SQLite (better-sqlite3) |

## Project Structure

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
│       ├── i18n/          # Internationalization (I18nContext, locales)
│       ├── components/    # Header, TabNav, StatusBar, Modal, Sidebar
│       │   ├── live/      # Controls, Transcript, Utterance
│       │   ├── history/   # SpeakerList
│       │   └── settings/  # SettingsTab
│       └── utils/         # api.js, constants.js, speakerColors.js
├── electron/              # Electron main process
│   ├── main.js            # Electron entry point
│   └── preload.js         # Preload script
├── scripts/
│   └── download-ffmpeg.js # Download ffmpeg binary for Electron build
├── build/                 # Build resources (entitlements, icons)
├── src/
│   ├── server.js          # Express + Socket.IO server
│   ├── audio/
│   │   ├── capture.js     # ffmpeg audio capture (macOS + Windows)
│   │   └── devices.js     # List input/output devices (macOS + Windows)
│   ├── soniox/
│   │   └── session.js     # Soniox real-time translation session
│   ├── storage/
│   │   ├── history.js     # SQLite DB (sessions, utterances, speaker aliases)
│   │   ├── settings.js    # Settings (~/.node-trans/settings.json)
│   │   └── export.js      # Export session to Markdown
│   └── routes/
│       └── api.js         # REST API endpoints
├── electron-builder.config.js  # Electron Builder configuration
├── dist/                  # Build output (generated by `npm run build`)
└── package.json
```

## Data Storage

Data is stored at `~/.node-trans/` (or Electron's userData directory):

- `settings.json` — application settings
- `history.db` — SQLite database containing conversation history

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List audio devices |
| GET | `/api/settings` | Read settings |
| PUT | `/api/settings` | Save settings |
| GET | `/api/sessions` | List sessions (supports `limit`, `offset`) |
| GET | `/api/sessions/:id` | Session detail + utterances |
| PATCH | `/api/sessions/:id` | Rename session |
| DELETE | `/api/sessions/:id` | Delete session |
| PUT | `/api/sessions/:id/speakers/:speaker` | Rename speaker |
| GET | `/api/sessions/:id/export` | Export as Markdown |

## Socket.IO Events

| Event (Client → Server) | Description |
|--------------------------|-------------|
| `start-listening` | Start capture + translation (supports `sessionId` for resume) |
| `pause-listening` | Pause capture |
| `resume-listening` | Resume capture |
| `stop-listening` | Stop capture |

| Event (Server → Client) | Description |
|--------------------------|-------------|
| `status` | Status update (listening, paused, sessionId, audioSource) |
| `utterance` | Complete utterance (source, original + translation) |
| `partial-result` | Partial/interim result |
| `error` | Error message |
