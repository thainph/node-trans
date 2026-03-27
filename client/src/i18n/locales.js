export const en = {
  // Common
  cancel: "Cancel",
  save: "Save",
  delete: "Delete",
  rename: "Rename",
  export: "Export",
  speaker: "Speaker",
  speakers: "Speakers",

  // Header
  toggleTheme: "Toggle theme",

  // Tabs
  tabLive: "Live",
  tabSettings: "Settings",

  // Status
  connecting: "Connecting...",
  connected: "Connected",
  listening: "Listening ({source})",
  paused: "Paused",
  stopped: "Stopped",
  disconnected: "Disconnected",

  // Sidebar
  sessions: "Sessions",
  showSessions: "Show sessions",
  hideSessions: "Hide sessions",
  noSessions: "No sessions yet",
  all: "All",
  msgs: "msgs",

  // Controls
  start: "Start",
  stop: "Stop",
  resume: "Resume",
  pause: "Pause",
  newSession: "New Session",
  newMeeting: "New Meeting",

  // Transcript
  pressResume: 'Press "Resume" to continue this session',
  pressStart: 'Press "Start" to listen and translate audio',

  // Session info
  started: "Started",
  duration: "Duration",
  source: "Source",
  target: "Target",
  context: "Context",
  utterances: "Utterances",
  inProgress: "In progress",

  // Dialogs
  deleteSession: "Delete session",
  deleteSessions: "Delete sessions",
  deleteSessionConfirm: "Are you sure you want to delete this session? This action cannot be undone.",
  deleteSessionsConfirm: "Are you sure you want to delete {count} session(s)? This action cannot be undone.",
  renameSession: "Rename session",
  renameSpeaker: "Rename {name}",

  // Settings sections
  sectionGeneral: "General",
  sectionAudio: "Audio & Translation",

  // Settings
  sonioxApiKey: "Soniox API Key:",
  enterApiKey: "Enter your Soniox API key",
  getApiKey: "Get your API key at",
  ffmpegNotFound: "ffmpeg not found.",
  ffmpegInstall: "Install ffmpeg and add it to PATH to use audio features.",
  ffmpegWindows: "Windows: download from ffmpeg.org, extract, and add the bin folder to system PATH.",
  noDevices: "No audio devices detected. Make sure your audio drivers are installed.",
  audioSource: "Audio Source:",
  micDevice: "Microphone Device:",
  systemDevice: "System Audio Device:",
  context: "Context",
  contextPlaceholder: "Enter custom context prompt",
  defaultContext: "Default Context:",
  defaultContextHint: "Applied automatically when starting a new session",
  none: "-- None --",
  autoDetect: "-- Auto-detect --",
  systemDeviceHint: "Windows: select Stereo Mix or VB-CABLE input device",
  micTargetLang: "Mic \u2192 Target Language:",
  sysTargetLang: "System Audio \u2192 Target Language:",
  targetLanguage: "Target Language:",
  saveSettings: "Save Settings",
  saved: "Saved!",
  saveFailed: "Failed to save settings",
  uiLanguage: "Interface Language:",

  // Audio source options
  srcMic: "Microphone",
  srcSystem: "System Audio",
  srcBoth: "Both (Microphone & System Audio)",

  // Error messages (from server)
  errNoApiKey: "Soniox API Key not configured. Go to Settings to enter your API key.",
  errInvalidApiKey: "Invalid API Key. Please check your Soniox API Key in Settings.",
  errNetwork: "Cannot connect to Soniox. Please check your network connection.",
  errStartFailed: "Failed to start: {detail}",
  errSessionNotFound: "Session not found or still active",
  errSystemDeviceNotFound: "System audio device index {index} not found",
  errNoLoopbackWin: "System audio device not found. Select a device in Settings, or install VB-CABLE.",
  errNoLoopbackMac: "BlackHole not installed. BlackHole is required to capture system audio.",
  errNoDevice: "No device configured for {source}",
  errAudioCapture: "Audio capture error ({source}): {detail}",
  errSoniox: "Soniox error: {detail}",

  // Overlay
  overlay: "Overlay",
  overlaySettings: "Overlay Settings",
  overlayOpacity: "Opacity:",
  overlayFontScale: "Font Scale:",
  overlayTextAlign: "Text Alignment:",
  overlayBgColor: "Background:",
  overlayFontFamily: "Font Family:",
  overlayDisplayMode: "Display Mode:",
  overlayAlignLeft: "Left",
  overlayAlignCenter: "Center",
  overlayAlignRight: "Right",
  overlayBgDark: "Dark",
  overlayBgLight: "Light",
  overlayModeBoth: "Partial + Final",
  overlayModeFinal: "Final only",
  overlayModePartial: "Partial only",
  overlayMaxLines: "Max Lines:",
};

export const vi = {
  // Common
  cancel: "H\u1EE7y",
  save: "L\u01B0u",
  delete: "X\u00F3a",
  rename: "\u0110\u1ED5i t\u00EAn",
  export: "Xu\u1EA5t",
  speaker: "Ng\u01B0\u1EDDi n\u00F3i",
  speakers: "Ng\u01B0\u1EDDi n\u00F3i",

  // Header
  toggleTheme: "Chuy\u1EC3n giao di\u1EC7n",

  // Tabs
  tabLive: "Tr\u1EF1c ti\u1EBFp",
  tabSettings: "C\u00E0i \u0111\u1EB7t",

  // Status
  connecting: "\u0110ang k\u1EBFt n\u1ED1i...",
  connected: "\u0110\u00E3 k\u1EBFt n\u1ED1i",
  listening: "\u0110ang nghe ({source})",
  paused: "T\u1EA1m d\u1EEBng",
  stopped: "\u0110\u00E3 d\u1EEBng",
  disconnected: "M\u1EA5t k\u1EBFt n\u1ED1i",

  // Sidebar
  sessions: "Phi\u00EAn",
  showSessions: "Hi\u1EC3n phi\u00EAn",
  hideSessions: "\u1EA8n phi\u00EAn",
  noSessions: "Ch\u01B0a c\u00F3 phi\u00EAn n\u00E0o",
  all: "T\u1EA5t c\u1EA3",
  msgs: "tin",

  // Controls
  start: "B\u1EAFt \u0111\u1EA7u",
  stop: "D\u1EEBng",
  resume: "Ti\u1EBFp t\u1EE5c",
  pause: "T\u1EA1m d\u1EEBng",
  newSession: "Phi\u00EAn m\u1EDBi",
  newMeeting: "Cu\u1ED9c h\u1ECDp m\u1EDBi",

  // Transcript
  pressResume: 'Nh\u1EA5n "Ti\u1EBFp t\u1EE5c" \u0111\u1EC3 ti\u1EBFp t\u1EE5c phi\u00EAn n\u00E0y',
  pressStart: 'Nh\u1EA5n "B\u1EAFt \u0111\u1EA7u" \u0111\u1EC3 nghe v\u00E0 d\u1ECBch \u00E2m thanh',

  // Session info
  started: "B\u1EAFt \u0111\u1EA7u",
  duration: "Th\u1EDDi l\u01B0\u1EE3ng",
  source: "Ngu\u1ED3n",
  target: "\u0110\u00EDch",
  context: "Ng\u1EEF c\u00E1nh",
  utterances: "C\u00E2u n\u00F3i",
  inProgress: "\u0110ang di\u1EC5n ra",

  // Dialogs
  deleteSession: "X\u00F3a phi\u00EAn",
  deleteSessions: "X\u00F3a phi\u00EAn",
  deleteSessionConfirm: "B\u1EA1n c\u00F3 ch\u1EAFc mu\u1ED1n x\u00F3a phi\u00EAn n\u00E0y? Thao t\u00E1c n\u00E0y kh\u00F4ng th\u1EC3 ho\u00E0n t\u00E1c.",
  deleteSessionsConfirm: "B\u1EA1n c\u00F3 ch\u1EAFc mu\u1ED1n x\u00F3a {count} phi\u00EAn? Thao t\u00E1c n\u00E0y kh\u00F4ng th\u1EC3 ho\u00E0n t\u00E1c.",
  renameSession: "\u0110\u1ED5i t\u00EAn phi\u00EAn",
  renameSpeaker: "\u0110\u1ED5i t\u00EAn {name}",

  // Settings sections
  sectionGeneral: "C\u00E0i \u0111\u1EB7t chung",
  sectionAudio: "\u00C2m thanh & D\u1ECBch thu\u1EADt",

  // Settings
  sonioxApiKey: "Soniox API Key:",
  enterApiKey: "Nh\u1EADp Soniox API key c\u1EE7a b\u1EA1n",
  getApiKey: "L\u1EA5y API key t\u1EA1i",
  ffmpegNotFound: "Kh\u00F4ng t\u00ECm th\u1EA5y ffmpeg.",
  ffmpegInstall: "C\u00E0i \u0111\u1EB7t ffmpeg v\u00E0 th\u00EAm v\u00E0o PATH \u0111\u1EC3 s\u1EED d\u1EE5ng t\u00EDnh n\u0103ng \u00E2m thanh.",
  ffmpegWindows: "Windows: t\u1EA3i t\u1EEB ffmpeg.org, gi\u1EA3i n\u00E9n v\u00E0 th\u00EAm th\u01B0 m\u1EE5c bin v\u00E0o PATH h\u1EC7 th\u1ED1ng.",
  noDevices: "Kh\u00F4ng ph\u00E1t hi\u1EC7n thi\u1EBFt b\u1ECB \u00E2m thanh. H\u00E3y ki\u1EC3m tra driver \u00E2m thanh.",
  audioSource: "Ngu\u1ED3n \u00E2m thanh:",
  micDevice: "Thi\u1EBFt b\u1ECB Microphone:",
  systemDevice: "Thi\u1EBFt b\u1ECB \u00E2m thanh h\u1EC7 th\u1ED1ng:",
  context: "Ng\u1EEF c\u00E1nh",
  contextPlaceholder: "Nh\u1EADp prompt ng\u1EEF c\u00E1nh t\u00F9y ch\u1EC9nh",
  defaultContext: "Ng\u1EEF c\u1EA3nh m\u1EB7c \u0111\u1ECBnh:",
  defaultContextHint: "T\u1EF1 \u0111\u1ED9ng \u00E1p d\u1EE5ng khi b\u1EAFt \u0111\u1EA7u phi\u00EAn m\u1EDBi",
  none: "-- Kh\u00F4ng --",
  autoDetect: "-- T\u1EF1 \u0111\u1ED9ng --",
  systemDeviceHint: "Windows: ch\u1ECDn Stereo Mix ho\u1EB7c VB-CABLE",
  micTargetLang: "Mic \u2192 Ng\u00F4n ng\u1EEF \u0111\u00EDch:",
  sysTargetLang: "\u00C2m thanh h\u1EC7 th\u1ED1ng \u2192 Ng\u00F4n ng\u1EEF \u0111\u00EDch:",
  targetLanguage: "Ng\u00F4n ng\u1EEF \u0111\u00EDch:",
  saveSettings: "L\u01B0u c\u00E0i \u0111\u1EB7t",
  saved: "\u0110\u00E3 l\u01B0u!",
  saveFailed: "L\u01B0u c\u00E0i \u0111\u1EB7t th\u1EA5t b\u1EA1i",
  uiLanguage: "Ng\u00F4n ng\u1EEF giao di\u1EC7n:",

  // Audio source options
  srcMic: "Microphone",
  srcSystem: "\u00C2m thanh h\u1EC7 th\u1ED1ng",
  srcBoth: "C\u1EA3 hai (Mic & \u00C2m thanh h\u1EC7 th\u1ED1ng)",

  // Error messages (from server)
  errNoApiKey: "Ch\u01B0a c\u00E0i \u0111\u1EB7t Soniox API Key. V\u00E0o C\u00E0i \u0111\u1EB7t \u0111\u1EC3 nh\u1EADp API key.",
  errInvalidApiKey: "API Key kh\u00F4ng h\u1EE3p l\u1EC7. Ki\u1EC3m tra l\u1EA1i Soniox API Key trong C\u00E0i \u0111\u1EB7t.",
  errNetwork: "Kh\u00F4ng th\u1EC3 k\u1EBFt n\u1ED1i \u0111\u1EBFn Soniox. Ki\u1EC3m tra k\u1EBFt n\u1ED1i m\u1EA1ng.",
  errStartFailed: "Kh\u00F4ng th\u1EC3 b\u1EAFt \u0111\u1EA7u: {detail}",
  errSessionNotFound: "Kh\u00F4ng t\u00ECm th\u1EA5y phi\u00EAn ho\u1EB7c phi\u00EAn v\u1EABn \u0111ang ho\u1EA1t \u0111\u1ED9ng",
  errSystemDeviceNotFound: "Kh\u00F4ng t\u00ECm th\u1EA5y thi\u1EBFt b\u1ECB \u00E2m thanh h\u1EC7 th\u1ED1ng (index {index})",
  errNoLoopbackWin: "Kh\u00F4ng t\u00ECm th\u1EA5y thi\u1EBFt b\u1ECB \u00E2m thanh h\u1EC7 th\u1ED1ng. Ch\u1ECDn thi\u1EBFt b\u1ECB trong C\u00E0i \u0111\u1EB7t ho\u1EB7c c\u00E0i VB-CABLE.",
  errNoLoopbackMac: "Ch\u01B0a c\u00E0i BlackHole. C\u1EA7n BlackHole \u0111\u1EC3 thu \u00E2m thanh h\u1EC7 th\u1ED1ng.",
  errNoDevice: "Ch\u01B0a c\u1EA5u h\u00ECnh thi\u1EBFt b\u1ECB cho {source}",
  errAudioCapture: "L\u1ED7i thu \u00E2m ({source}): {detail}",
  errSoniox: "L\u1ED7i Soniox: {detail}",

  // Overlay
  overlay: "Overlay",
  overlaySettings: "C\u00E0i \u0111\u1EB7t Overlay",
  overlayOpacity: "\u0110\u1ED9 m\u1EDD:",
  overlayFontScale: "C\u1EE1 ch\u1EEF:",
  overlayTextAlign: "C\u0103n ch\u1EEF:",
  overlayBgColor: "N\u1EC1n:",
  overlayFontFamily: "Font ch\u1EEF:",
  overlayDisplayMode: "Ch\u1EBF \u0111\u1ED9 hi\u1EC3n th\u1ECB:",
  overlayAlignLeft: "Tr\u00E1i",
  overlayAlignCenter: "Gi\u1EEFa",
  overlayAlignRight: "Ph\u1EA3i",
  overlayBgDark: "T\u1ED1i",
  overlayBgLight: "S\u00E1ng",
  overlayModeBoth: "T\u1EA1m th\u1EDDi + Ho\u00E0n ch\u1EC9nh",
  overlayModeFinal: "Ch\u1EC9 ho\u00E0n ch\u1EC9nh",
  overlayModePartial: "Ch\u1EC9 t\u1EA1m th\u1EDDi",
  overlayMaxLines: "S\u1ED1 d\u00F2ng t\u1ED1i \u0111a:",
};
