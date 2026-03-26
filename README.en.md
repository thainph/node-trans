# Node Trans

[Tiếng Việt](README.md)

Real-time audio translation app powered by the [Soniox API](https://soniox.com/docs/stt/rt/real-time-translation). Captures audio from microphone, system audio, or both, translates to a target language, and saves conversation history.

Supports **macOS** and **Windows**.

## Requirements

- **Node.js** >= 20
- **ffmpeg**
- **Soniox API Key** (sign up at [soniox.com](https://soniox.com))

### Install ffmpeg

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

# Create .env file
echo "SONIOX_API_KEY=your_api_key_here" > .env
```

## Running

```bash
# Production
npm start

# Development (run server + client concurrently)
npm run dev
```

- Production: open `http://localhost:3000`
- Development: open `http://localhost:5173` (Vite dev server, proxies API automatically)

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

### Live Translation Tab

- Press **▶ Start** to begin listening and translating
- **⏸ Pause** — pause capture while keeping the session
- **▶ Resume** — continue capture in the same session
- **⊕ New Meeting** — end current session and start a new one
- **⏹ Stop** — end the session

Each speaker is distinguished by a unique color. Original text and translations are displayed in real-time.

### History Tab

- Lists all saved sessions with timestamps, duration, source, utterance count, and speaker count
- **Click** a session to view details
- **Long press** to enter multi-select mode → bulk delete
- In session detail:
  - **Rename session** via the 🖊️ button next to the title
  - **Rename speakers** (e.g. "Speaker 1" → "John") via the 🖊️ button in the speaker list
  - **Export to Markdown** to save the conversation as a `.md` file

### Settings Tab

| Setting | Description |
|---------|-------------|
| Audio Source | Microphone / System Audio / Both |
| Microphone Device | Select microphone (from input device list) |
| System Audio Device | Select device for system audio capture (VB-CABLE, Stereo Mix, etc.). Shown when Audio Source is System Audio or Both |
| Target Language | Translation language (default: Vietnamese) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4, Socket.IO Client |
| Backend | Node.js, Express 5, Socket.IO |
| Audio | ffmpeg (avfoundation on macOS, dshow on Windows) |
| Speech-to-Text | Soniox API (realtime translation) |
| Database | SQLite (sql.js — pure JavaScript, no native build tools required) |

## Project Structure

```
node-trans/
├── client/              # React frontend (Vite + Tailwind CSS)
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── style.css
│       ├── hooks/       # useTheme
│       ├── context/     # SocketContext (useReducer)
│       ├── components/  # Header, TabNav, StatusBar, Modal
│       │   ├── live/    # Controls, Transcript, Utterance, PartialResult
│       │   ├── history/ # SessionList, SessionItem, SessionDetail, SpeakerList
│       │   └── settings/# SettingsTab
│       └── utils/       # api.js, constants.js, speakerColors.js
├── src/
│   ├── server.js        # Express + Socket.IO server
│   ├── audio/
│   │   ├── capture.js   # ffmpeg audio capture (macOS + Windows)
│   │   └── devices.js   # List input/output devices (macOS + Windows)
│   ├── soniox/
│   │   └── session.js   # Soniox real-time translation session
│   ├── storage/
│   │   ├── history.js   # SQLite DB (sessions, utterances, speaker aliases)
│   │   ├── settings.js  # Settings (~/.node-trans/settings.json)
│   │   └── export.js    # Export session to Markdown
│   └── routes/
│       └── api.js       # REST API endpoints
├── dist/                # Build output (generated by `npm run build`)
├── .env                 # SONIOX_API_KEY
└── package.json
```

## Data Storage

Data is stored at `~/.node-trans/`:

- `settings.json` — application settings
- `history.db` — SQLite database containing conversation history

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List audio devices |
| GET | `/api/settings` | Read settings |
| PUT | `/api/settings` | Save settings |
| GET | `/api/sessions` | List sessions |
| GET | `/api/sessions/:id` | Session detail + utterances |
| PATCH | `/api/sessions/:id` | Rename session |
| DELETE | `/api/sessions/:id` | Delete session |
| PUT | `/api/sessions/:id/speakers/:speaker` | Rename speaker |
| GET | `/api/sessions/:id/export` | Export as Markdown |

## Socket.IO Events

| Event (Client → Server) | Description |
|--------------------------|-------------|
| `start-listening` | Start capture + translation |
| `pause-listening` | Pause capture |
| `resume-listening` | Resume capture |
| `stop-listening` | Stop capture |

| Event (Server → Client) | Description |
|--------------------------|-------------|
| `status` | Status update (listening, paused, audioSource) |
| `utterance` | Complete utterance (original + translation) |
| `partial-result` | Partial/interim result |
| `error` | Error message |
