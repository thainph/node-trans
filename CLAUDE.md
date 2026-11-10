# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time audio transcription + translation app. Captures audio from microphone, system audio, or both, and transcribes/translates it with one of two engines:
- **Soniox** (cloud, `stt-rt-v6`) — transcription, translation and speaker diarization built in.
- **Local Whisper** (offline) — `faster-whisper` in a Python subprocess, optional pyannote diarization, optional translation via Ollama or LibreTranslate.

Runs as a web app or Electron desktop app on macOS, Windows and Linux. Sessions are stored in SQLite.

More detail: `ARCHITECTURE.md` (data flow, Node↔Python protocol, DB schema, settings keys) and `DEV-BUILD.md` (build + troubleshooting). `AUDIO-CAPTURE.md` describes the older BlackHole/VB-CABLE approach, which the native `audiocap` binaries have replaced.

## Commands

```bash
npm run dev                 # Express (node --watch) + Vite dev server
npm run dev:server          # backend only
npm run dev:client          # Vite only
npm start                   # build frontend + serve from dist/ on :3333
npm run build               # Vite build → dist/ (two entries: index.html + overlay.html)

npm run electron:dev        # Vite + Electron (Electron loads http://localhost:5173 when unpackaged)
npm run electron:build[:mac|:win|:linux]   # output in release/

npm run setup:audiocap      # rebuild native system-audio binaries (Swift on macOS, .NET 8 cross-compile for Windows)
npm run setup:ffmpeg        # copy ffmpeg into ffmpeg-bin/ before packaging Electron
npm run setup:diarize       # create ~/.node-trans/venv with torch + pyannote + faster-whisper
```

There are no test or lint commands.

**Native module ABI gotcha:** `better-sqlite3` must be compiled separately for Node and Electron. `npm run dev`/`start` run `native:node`, and Electron scripts run `native:electron`. If you see `NODE_MODULE_VERSION` errors after switching between web and Electron, run the matching `native:*` script. Keep `npmRebuild: false` in `electron-builder.config.js`.

Releases: pushing a `v*` tag triggers `.github/workflows/release.yml` (builds mac/win/linux via electron-builder; the mac build is unsigned when no cert secret is set).

## Architecture

ES Modules throughout (`"type": "module"`).

### Ports / URLs
- Backend: `http://localhost:3333` (hardcoded in `src/server.js` `startServer`)
- Vite dev: `http://localhost:5173`, which proxies `/api` and `/socket.io` to 3333 (`client/vite.config.js`)
- `public/` is legacy. The server serves `dist/`.

### Backend (`src/`)
- **server.js**: Express 5 + Socket.IO, exporting `startServer`/`stopServer` (Electron imports these). Heavy modules (history, soniox, capture, whisper, diarize, devices) are lazy-loaded through cached `import()` promises. Per-socket session state lives in the in-memory `activeSessions` Map. Socket events: `start-listening` / `pause-listening` / `resume-listening` / `stop-listening` in; `status` / `partial-result` / `utterance` / `error` out.
- **audio/capture.js**: The mic path uses ffmpeg (`avfoundation` / `dshow` / `pulse`). The system-audio path spawns the native `audiocap` binary (macOS ScreenCaptureKit, Windows WASAPI loopback; prebuilt in `audiocap-bin/`, source in `swift-audiocap/` and `wasapi-audiocap/`). On Linux, system audio uses ffmpeg with PulseAudio monitor sources. All paths output PCM s16le 16 kHz mono, re-chunked into 120 ms (3840-byte) chunks. Pause/resume goes through a gate stream that drops audio while the process keeps running.
- **soniox/session.js**, **local/whisper-session.js**, **local/diarize-session.js**: STT session factories sharing a callback interface (partial / utterance / error). The local engines spawn Python workers (`whisper-worker.py`, `diarize.py`) and talk newline-delimited JSON over stdin/stdout. Diarize falls back to whisper-session on timeout or crash.
- **local/*-setup.js**: Create a shared venv at `~/.node-trans/venv` and stream progress to the UI via SSE (`routes/api.js`). `local/python-utils.js` resolves the venv Python. In Electron, Python scripts are resolved from the ASAR-unpacked path (see `asarUnpack` in `electron-builder.config.js`).
- **local/translate.js**: Ollama/LibreTranslate translation for the local engine. Failures are non-fatal and return an empty string.
- **storage/**: `history.js` (better-sqlite3: sessions, utterances, speaker_aliases), `settings.js` (JSON, loaded synchronously), `export.js` (Markdown).
- **Data dir**: `~/.node-trans/` in web mode, or `<userData>/data/` when `ELECTRON_USER_DATA` is set by Electron. The Python venv is always under `~/.node-trans/venv`. Logs go to `<data dir>/logs/app.log`.
- **ffmpeg / audiocap resolution**: `FFMPEG_PATH` and `AUDIOCAP_PATH` env vars. Electron's `main.js` sets them before importing the server. In web mode, `server.js` falls back to `ffmpeg-static` and auto-detects audiocap.

### "both" audio source
Two captures and two STT sessions run in parallel, and speaker IDs are prefixed with `mic:` / `system:` to avoid collisions. Each source can have its own target language.

### Frontend (`client/src/`)
- React 19 + Vite + Tailwind v4 SPA, with no router. Two entry points: `main.jsx` (app) and `overlay-main.jsx` (always-on-top overlay window).
- **context/SocketContext.jsx**: The central `useReducer` store: socket connection, listening state, utterances, speaker colors, session selection, overlay state and toasts.
- **i18n/**: EN/VI UI strings in `locales.js` via `t()`. Any new UI string needs both languages.
- **utils/constants.js**: Language list, Whisper/Ollama model options, context presets.

### Electron (`electron/`)
- `main.js` starts the Express server in-process, creates the main window plus a transparent frameless overlay window, wires IPC, and handles auto-update (`electron-updater`).
- `preload.js` exposes `window.electronAPI`, and `overlay-preload.js` exposes `window.overlayAPI`.

## Configuration

The Soniox API key comes from `.env` (`SONIOX_API_KEY`) or from the Settings UI, and the UI value takes precedence. The API returns the key masked in GET/PUT settings responses. Diarization requires a HuggingFace token in settings.
