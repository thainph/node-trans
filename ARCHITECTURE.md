# node-trans — Architecture & Data Flow

## Overview

A real-time audio translation app. Captures audio from microphone or system output, transcribes (STT), translates, and stores session history. Runs as a web app or Electron desktop app.

---

## Main Data Flow

```
Audio device (mic / system audio)
        │
        ├── Mic: FFmpeg (avfoundation / dshow)
        └── System: audiocap (ScreenCaptureKit on macOS, WASAPI on Windows)
        │
        ▼
   PCM s16le · 16kHz · mono
        │
        ▼
  capture.js (ChunkTransform)
  Normalizes into 120ms chunks (3,840 bytes)
        │
        ├─────────────────────────────────────────────┐
        ▼                                             ▼
  [Engine: Soniox]                        [Engine: Local Whisper]
  soniox/session.js                       whisper-session.js / diarize-session.js
        │                                             │
        ▼                                             ▼
  Soniox Cloud API                   whisper-worker.py (Python subprocess)
  · Real-time transcription          · faster-whisper (CPU, int8)
  · Cloud translation                · 4s sliding window, 2.5s stride
  · Speaker diarization (cloud)      · Silence detection → early flush (2 empty windows)
                                     · Max accumulation flush (200 chars)
                                     · Outputs partial + utterance events
                                     · Translation via Ollama / LibreTranslate (if enabled)
        │                                             │
        │                              ┌──────────────┴──────────────┐
        │                              ▼                             ▼
        │                    [No diarization]          [HF Token → Diarization]
        │                    speaker: null              diarize-session.js
        │                                                     │
        │                                                     ▼
        │                                              diarize.py (Python subprocess)
        │                                              · faster-whisper (CPU, int8)
        │                                              · pyannote/speaker-diarization-3.1 (MPS/CUDA)
        │                                              · 6s window, 3s stride
        │                                              · speaker: SPEAKER_00, SPEAKER_01...
        │                                              [Fallback to whisper-session on error]
        │
        ▼
   Socket.IO (server.js)
   emit: "utterance", "partial-result"
        │
        ├──────────────────────────────┐
        ▼                             ▼
   React UI (browser)          Overlay window (Electron)
   · Live transcript           · Always-on-top
   · Speaker colors            · Transparent, frameless
   · Session history           · Draggable
        │
        ▼
   SQLite (history.db)
   · Sessions + Utterances + Speaker aliases
```

---

## Components

### Backend (`src/`)

| File | Role |
|------|------|
| `server.js` | Express 5 + Socket.IO. Manages sessions, orchestrates audio capture and STT. Lazy-loads heavy modules. Tracks active sessions per socket in an in-memory Map |
| `logger.js` | Centralized structured logging with file rotation. Logs to `~/.node-trans/logs/app.log`, rotates at 10MB, mirrors to console only in dev mode |
| `audio/capture.js` | Spawns FFmpeg (mic) or audiocap (system audio), normalizes PCM into 120ms chunks via ChunkTransform, supports pause/resume via gate stream |
| `audio/devices.js` | Lists audio devices by parsing ffmpeg output. 120-second cache. Uses `system_profiler` (macOS) or PowerShell (Windows) for output devices. Checks audiocap availability |
| `soniox/session.js` | Soniox SDK wrapper (RealtimeUtteranceBuffer). Real-time transcription + translation + speaker diarization via cloud |
| `local/whisper-session.js` | Offline STT. Spawns `whisper-worker.py` as a persistent subprocess; sends base64 audio via stdin JSON. Translation debouncing (500ms) for partials |
| `local/whisper-setup.js` | Setup helper: creates `~/.node-trans/venv`, installs `faster-whisper`, downloads model via `whisper-download.py`. Supports upgrade from openai-whisper |
| `local/whisper-worker.py` | Persistent Python STT worker. Loads faster-whisper model once (CPU, int8), 4s sliding window with 2.5s stride, emits `partial`/`utterance` JSON |
| `local/whisper-download.py` | Downloads faster-whisper models from HuggingFace Hub with JSON progress reporting |
| `local/diarize-session.js` | Python subprocess wrapper. Sends audio via stdin, receives utterances via stdout. Falls back to whisper-session on failure (120s timeout or crash) |
| `local/diarize-setup.js` | Setup helper: creates shared `~/.node-trans/venv`, installs torch + torchaudio + faster-whisper + pyannote.audio 3.1.1. Checks existing packages, installs only what's missing |
| `local/diarize.py` | Python worker: pyannote 3.1.1 + faster-whisper. Receives base64 PCM, returns JSON utterances with speaker labels. Includes compatibility shims for torchaudio 2.0+ and NumPy 2.0 |
| `local/translate.js` | Calls Ollama or LibreTranslate. Sends context (first 200 chars) to Ollama for better translation. Non-fatal: returns empty string on error |
| `local/python-utils.js` | Resolves Python binary from `~/.node-trans/venv`. Platform-specific probing (macOS/Windows) |
| `local/setup-log.js` | Wraps setup event callbacks with persistent file logging. Logs progress at milestones (0%, 10%, ..., 100%) |
| `storage/history.js` | SQLite (better-sqlite3). CRUD for sessions, utterances, speaker aliases. Supports session resumption |
| `storage/settings.js` | Reads/writes `settings.json`. Loaded synchronously |
| `storage/export.js` | Exports sessions to Markdown, plain text or Word (.docx), in a conversation or bilingual-table layout; several sessions are bundled into a .zip (`GET /api/sessions/:id/export`, `GET /api/sessions/export?ids=`) |
| `routes/api.js` | REST API: settings, sessions, devices, local setup (Whisper/Diarize via SSE), focused status checks (Whisper, Ollama, LibreTranslate, Diarize) |

### Frontend (`client/src/`)

| File | Role |
|------|------|
| `App.jsx` | Main app component |
| `main.jsx` | Entry point for main app |
| `overlay-main.jsx` | Entry point for overlay app (separate HTML entry) |
| `context/SocketContext.jsx` | Central state (useReducer). Socket.IO connection, utterances, speaker colors, session selection, overlay state, toast notifications |
| `components/Header.jsx` | Header bar with theme toggle |
| `components/Sidebar.jsx` | Session list sidebar with sorting/filtering |
| `components/TabNav.jsx` | Tab navigation UI |
| `components/StatusBar.jsx` | Connection and listening status display |
| `components/Toast.jsx` | Toast notification container |
| `components/Modal.jsx` | Base modal dialog component |
| `components/StartupCheck.jsx` | Initial setup verification |
| `components/live/LiveTab.jsx` | Main live transcription tab |
| `components/live/Controls.jsx` | Start/stop/pause/resume buttons with settings |
| `components/live/Transcript.jsx` | Transcript display area |
| `components/live/Utterance.jsx` | Single utterance with speaker & translation |
| `components/live/OverlayWindow.jsx` | Draggable overlay window for web version |
| `components/settings/SettingsTab.jsx` | Comprehensive settings panel (audio, engine, context, overlay tabs) |
| `components/settings/OverlaySettings.jsx` | Overlay-specific customization options |
| `components/history/SpeakerList.jsx` | Speaker list for current session |
| `hooks/useTheme.js` | Theme toggle hook |
| `hooks/useDraggable.js` | Draggable overlay hook |
| `utils/api.js` | Fetch wrapper for REST API calls |
| `utils/constants.js` | Language options (30+), Whisper model options, Ollama model options, context presets |
| `utils/speakerColors.js` | Speaker-to-color mapping (mod 8 palette) |
| `i18n/I18nContext.jsx` | Bilingual UI provider (EN/VI). `t()` function with parameter substitution |
| `i18n/locales.js` | All UI strings (226+ keys per language) |

### Electron (`electron/`)

| File | Role |
|------|------|
| `main.js` | Starts the Express server internally, loads the app URL. Sets FFMPEG_PATH and AUDIOCAP_PATH. Manages main window (1200x800) + overlay window (500x220, always-on-top, transparent, frameless). IPC bridge for overlay toggle/data/settings/drag |
| `preload.js` | Exposes `window.electronAPI` to the renderer (toggleOverlay, sendOverlayData, sendOverlaySettings, onOverlayClosed) |
| `overlay-preload.js` | Exposes `window.overlayAPI` to the overlay renderer (onData, onSettings, close, dragStart, dragMove) |

---

## STT Engines

### Soniox (Cloud)

```
Audio chunks → Soniox SDK → Cloud API
                              · Model: stt-rt-v6
                              · Real-time streaming
                              · Built-in translation
                              · Built-in speaker diarization
```

Pros: low latency, high quality, no local setup required.
Cons: requires API key and internet connection.

### Local Whisper (Offline)

```
Audio chunks → whisper-worker.py (Python subprocess, model loaded once)
                    · faster-whisper running on CPU (int8 quantization)
                    · 4s sliding window, 2.5s stride (1.5s overlap for context)
                    · Silence detection → early flush (2 consecutive empty windows)
                    · Max accumulation flush (≥200 chars)
                    · Emits: partial (in-progress), utterance (committed)
                [if HF token set]
                → diarize.py (Python subprocess) — replaces whisper-worker.py
                      · pyannote 3.1.1: who is speaking? (MPS/CUDA)
                      · faster-whisper: what are they saying? (CPU, int8)
                      · 6s window, 3s stride
                      · Combined → utterance + speaker label
```

Pros: fully offline, free.
Cons: requires Python 3.10+ and initial setup (via UI or `npm run setup:diarize`).

---

## Node.js ↔ Python Protocol

Newline-delimited JSON over stdin/stdout. Both workers share the same inbound message format.

### whisper-worker.py (Local Whisper, no diarization)

```
Node → Python:
  {"type": "audio",    "data": "<base64 PCM s16le 16kHz mono>"}
  {"type": "flush"}
  {"type": "shutdown"}

Python → Node:
  {"type": "ready"}
  {"type": "partial",   "text": "..."}   -- growing in-progress text
  {"type": "utterance", "text": "..."}   -- final committed utterance
  {"type": "error",     "message": "..."}
```

Waits up to 60s for `ready` (model load). Model is loaded once per session.

### diarize.py (Diarization with speaker labels)

```
Node → Python:
  {"type": "audio",    "data": "<base64 PCM>"}
  {"type": "flush"}
  {"type": "shutdown"}

Python → Node:
  {"type": "ready"}
  {"type": "partial",   "text": "..."}
  {"type": "utterance", "text": "...", "speaker": "SPEAKER_00", "start": 0.5, "end": 3.2}
  {"type": "error",    "message": "..."}
```

Waits up to 120s for `ready` (covers model download on first run). If it times out or crashes, automatically falls back to whisper-session (speaker: null).

---

## Database (SQLite)

Path: `~/.node-trans/history.db` (web) or `userData/data/history.db` (Electron)

```sql
sessions        -- id, title, started_at, ended_at, audio_source, target_language, device_name, context
utterances      -- id, session_id, timestamp, speaker, original_text, original_language,
                --    translated_text, translation_language, source
speaker_aliases -- session_id, speaker ("SPEAKER_00"), alias (user-defined name)
```

---

## Settings & Config Files

| File | Location |
|------|----------|
| `settings.json` | `~/.node-trans/settings.json` (web) / `userData/data/settings.json` (Electron) |
| `history.db` | `~/.node-trans/history.db` (web) / `userData/data/history.db` (Electron) |
| `venv` | `~/.node-trans/venv/` (shared Python venv: faster-whisper + pyannote.audio) |
| `logs/` | `~/.node-trans/logs/` (app.log + setup logs with rotation) |

Key settings:

```
audioSource             mic / system / both
transcriptionEngine     soniox / local-whisper
whisperModel            tiny / base / small / medium / large-v3-turbo / large
whisperLanguage         auto / en / vi / ...
localTranslationEngine  none / ollama / libretranslate
ollamaModel             gemma3:4b / llama3.2 / ...
hfToken                 Hugging Face READ token (for diarization)
targetLanguage          vi / en / ja / ...
context                 none / casual / business / IT / news / entertainment / custom
```

---

## Session Lifecycle

```
User clicks "Start"
    │
    ▼
Socket emits "start-listening" { sessionId?, context? }
    │
    ├── sessionId provided → reopen session from DB (reuse audio source, language, context)
    └── no sessionId → create new session
    │
    ▼
Resolve audio devices
    · Mic: from settings or device index 0
    · System: native capture via audiocap (ScreenCaptureKit on macOS, WASAPI on Windows)
    │
    ▼
Lazy-load STT factory (Soniox / Whisper / Diarize)
Create STT session(s) (1 or 2 if audioSource = "both")
    · "both" mode: speaker IDs prefixed with "mic:" or "system:"
    │
    ▼
Start streaming audio → STT
    │
    ├── onPartial → socket.emit("partial-result") → UI shows in-progress text
    └── onUtterance → DB.addUtterance() + socket.emit("utterance") → UI + Overlay
    │
    ├── User clicks "Pause" → gate stream closes, audio drops, STT keeps running
    └── User clicks "Resume" → gate stream opens, audio flow resumes
    │
User clicks "Stop" (or disconnect)
    │
    ▼
stopSession:
    · Delete from activeSessions (prevent double-stop)
    · Stop all captures (synchronously)
    · End DB session (set ended_at = now)
    · Stop all STT sessions (parallel)
    · Cleanup audio streams
```

Session state:
```javascript
{
  dbSessionId,        // Database session ID
  audioSource,        // "mic" | "system" | "both"
  paused,             // true/false
  captures: [],       // Array of capture objects (one per source)
  sttSessions: []     // Array of STT session objects (one per source)
}
```

---

## Key Implementation Patterns

### Lazy Module Loading
server.js caches module `import()` Promises — each heavy module (history, soniox, capture, whisper, diarize, devices) is loaded once and shared by all concurrent callers.

### Error Handling
- STT errors emit to client: `errWhisper` (local) or `errSoniox` (API)
- Network errors: `errNetwork` (ENOTFOUND/ECONNREFUSED), `errInvalidApiKey` (401/Unauthorized)
- Diarization fallback: diarize → whisper on timeout/crash (no speaker labels but preserves transcript)

### Translation Debouncing
- Partials: emit immediately with last known translation, debounce actual translation call (500ms)
- Utterances: always translate immediately (final commits)

---

## System Requirements

| Component | Required | Notes |
|-----------|----------|-------|
| Node.js >= 20 | Yes | Runtime |
| ffmpeg | Yes | Microphone audio capture |
| audiocap | Yes (for system audio) | Built via `npm run setup:audiocap`. Uses ScreenCaptureKit (macOS) / WASAPI (Windows) |
| Python 3.10+ + faster-whisper | Only for Local Whisper | Setup via UI (Settings → Engine → Setup Whisper) |
| pyannote.audio 3.1.1 | Only for Diarization | Setup via UI or `npm run setup:diarize` |
| Ollama | Only for Ollama translation | `ollama serve` must be running |
| LibreTranslate | Only for LibreTranslate | Server must be running |
| Soniox API Key | Only for Soniox engine | cloud.soniox.com |
| HuggingFace Token | Only for Diarization | huggingface.co/settings/tokens |
