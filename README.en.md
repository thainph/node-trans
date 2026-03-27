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

To capture system audio (Google Meet, Zoom, YouTube, etc.), your computer needs a **virtual audio driver** — a virtual sound device that acts as a bridge between speakers and a microphone input, allowing the app to hear what's playing.

> **Why is this needed?** By default, the OS doesn't allow apps to directly tap into audio output. A virtual driver creates an intermediary device: you route your output to it, and the app reads input from that same device.

---

### macOS — BlackHole

**BlackHole** is a free, widely-used virtual audio driver for macOS.

#### Step 1 — Install BlackHole

**Option A: Homebrew (recommended)**
```bash
brew install blackhole-2ch
```

**Option B: Direct download**
- Go to [existential.audio/blackhole](https://existential.audio/blackhole/) → choose **BlackHole 2ch** → enter your email → download the `.pkg` file → run the installer

After installation, **restart your Mac** to load the driver.

#### Step 2 — Verify installation

1. Open **System Settings → Sound**
2. In both the **Output** and **Input** tabs, you should see **BlackHole 2ch** in the list
3. If not visible → restart your Mac

#### Step 3 — Create an Aggregate Device (to hear audio AND capture simultaneously)

> This step is important: if you only set BlackHole as your output, your speakers will go silent. An Aggregate Device routes audio to your speakers **and** BlackHole at the same time.

1. Open **Audio MIDI Setup**
   - Spotlight (⌘ Space) → type "Audio MIDI Setup" → Enter
   - Or: `/Applications/Utilities/Audio MIDI Setup.app`

2. Click **"+"** at the bottom left → select **Create Aggregate Device**

3. In the device list on the right, **check both**:
   - ✅ **BlackHole 2ch**
   - ✅ **Your speakers** (e.g. "MacBook Pro Speakers", "External Headphones")

4. Give it a memorable name, e.g. **"Node Trans Aggregate"**
   - Double-click the name "Aggregate Device" in the left column to rename it

5. Set the **clock source** to your main speakers (not BlackHole) to avoid audio crackling

#### Step 4 — Set the Aggregate Device as your default output

1. Go to **System Settings → Sound → Output**
2. Select **"Node Trans Aggregate"** (or whatever you named it)
3. Audio will now play through your speakers while BlackHole captures it simultaneously

#### Step 5 — Configure in the app

1. Open the **Settings** tab in Node Trans
2. **Audio Source** → select **"System Audio"** or **"Both"** (if you want to translate both mic and system audio)
3. **System Audio Device** → select **"BlackHole 2ch"**
4. Press **Start** — the app will begin translating system audio

> **When done:** Remember to switch your Output back to your original speakers (MacBook Pro Speakers) in System Settings → Sound, as the Aggregate Device can introduce a small audio delay.

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| BlackHole not showing in device list | Restart your Mac; reinstall if still missing |
| Audio delay or echo | In Audio MIDI Setup, set Clock Source to your main speakers |
| App doesn't detect BlackHole | Restart the app; verify the correct System Audio Device is selected |
| No audio after setup | Check System Settings → Sound → Output, reselect the Aggregate Device |

---

### Windows — VB-CABLE

**VB-CABLE** is a free virtual audio driver for Windows that creates a pair of devices: **CABLE Input** (virtual output) and **CABLE Output** (virtual input).

#### Step 1 — Download and install VB-CABLE

1. Go to [vb-audio.com/Cable](https://vb-audio.com/Cable/)
2. Scroll to **"Download VB-CABLE Driver"** → click to download
3. Extract the `.zip` → run **`VBCABLE_Setup_x64.exe`** (64-bit) as **Administrator**
   - Right-click → **Run as administrator**
4. Click **"Install Driver"** → wait for completion
5. **Restart your computer** — required for the driver to work

#### Step 2 — Verify installation

1. Right-click the speaker icon in the taskbar → **Sound settings**
2. Under **Output**, you should see **"CABLE Input (VB-Audio Virtual Cable)"**
3. Under **Input**, you should see **"CABLE Output (VB-Audio Virtual Cable)"**

#### Step 3 — Route your output to CABLE Input

1. Go to **Settings → System → Sound** (or right-click speaker icon → Open Sound settings)
2. Under **Output** → select **"CABLE Input (VB-Audio Virtual Cable)"**

> ⚠️ After this step, your speakers will go **silent** because audio is now routed into CABLE. See Step 4 to hear audio again.

#### Step 4 — Enable "Listen to this device" to hear speakers simultaneously (optional)

If you want to hear audio while the app captures it:

1. Right-click the speaker icon → **Sounds** → **Recording** tab
2. Double-click **"CABLE Output (VB-Audio Virtual Cable)"**
3. **Listen** tab → check **"Listen to this device"**
4. **Playback through this device** → select your actual speakers/headphones
5. Click OK → Apply

#### Step 5 — Configure in the app

1. Open the **Settings** tab in Node Trans
2. **Audio Source** → select **"System Audio"** or **"Both"**
3. **System Audio Device** → select **"CABLE Output (VB-Audio Virtual Cable)"**
4. Press **Start**

#### Alternative — Stereo Mix (no extra software)

Some Windows computers have a built-in **Stereo Mix** feature (commonly available on Realtek audio chipsets):

1. Right-click the speaker icon → **Sounds** → **Recording** tab
2. Right-click in the empty area → select **"Show Disabled Devices"**
3. If **Stereo Mix** appears → right-click → **Enable**
4. In the app, select **Stereo Mix** as the System Audio Device

> Stereo Mix doesn't require Step 3 (no need to change Output device), but capture quality may be lower than VB-CABLE.

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| CABLE not showing after install | Restart your PC; verify you ran the installer as Administrator |
| No audio after selecting CABLE as output | Enable "Listen to this device" as described in Step 4 |
| App doesn't see CABLE Output in dropdown | Restart the app; verify the driver is correctly installed |
| High audio latency | Open VB-CABLE Control Panel → increase the buffer size |

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
