export const SOURCE_LABELS = {
  mic: "Mic",
  system: "System",
  both: "Mic + System",
};

export const SOURCE_LABELS_FULL = {
  mic: "Microphone",
  system: "System Audio",
  both: "Mic + System",
};

export const LANG_LABELS_FULL = {
  vi: "Tiếng Việt", en: "English", ja: "日本語", ko: "한국어",
  zh: "中文", fr: "Français", es: "Español", de: "Deutsch",
  pt: "Português", ru: "Русский", ar: "العربية", hi: "हिन्दी",
  th: "ไทย", id: "Bahasa Indonesia", ms: "Bahasa Melayu", tl: "Filipino",
  it: "Italiano", nl: "Nederlands", pl: "Polski", tr: "Türkçe",
  uk: "Українська", cs: "Čeština", sv: "Svenska", da: "Dansk",
  fi: "Suomi", no: "Norsk", el: "Ελληνικά", he: "עברית",
  ro: "Română", hu: "Magyar", bg: "Български",
};

export const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "ru", label: "Русский" },
  { value: "ar", label: "العربية" },
  { value: "hi", label: "हिन्दी" },
  { value: "th", label: "ไทย" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "ms", label: "Bahasa Melayu" },
  { value: "tl", label: "Filipino" },
  { value: "it", label: "Italiano" },
  { value: "nl", label: "Nederlands" },
  { value: "pl", label: "Polski" },
  { value: "tr", label: "Türkçe" },
  { value: "uk", label: "Українська" },
  { value: "cs", label: "Čeština" },
  { value: "sv", label: "Svenska" },
  { value: "da", label: "Dansk" },
  { value: "fi", label: "Suomi" },
  { value: "no", label: "Norsk" },
  { value: "el", label: "Ελληνικά" },
  { value: "he", label: "עברית" },
  { value: "ro", label: "Română" },
  { value: "hu", label: "Magyar" },
  { value: "bg", label: "Български" },
];

export const WHISPER_MODEL_OPTIONS = [
  { value: "tiny",           label: "Tiny (~75MB)",
    en: "Fastest · Lowest accuracy · Good for quick tests",
    vi: "Nhanh nhất · Độ chính xác thấp · Phù hợp thử nghiệm" },
  { value: "base",           label: "Base (~150MB)",
    en: "Fast · Decent accuracy · Recommended for most users",
    vi: "Nhanh · Khá chính xác · Phù hợp cho hầu hết người dùng" },
  { value: "small",          label: "Small (~500MB)",
    en: "Balanced speed & accuracy · Good for multiple languages",
    vi: "Cân bằng tốc độ & độ chính xác · Tốt cho nhiều ngôn ngữ" },
  { value: "medium",         label: "Medium (~1.5GB)",
    en: "High accuracy · Slower · Requires more RAM",
    vi: "Độ chính xác cao · Chậm hơn · Cần nhiều RAM hơn" },
  { value: "large-v3-turbo", label: "Large v3 Turbo (~1.6GB)",
    en: "Best speed/quality ratio · Recommended for Apple Silicon",
    vi: "Tỉ lệ tốc độ/chất lượng tốt nhất · Khuyên dùng cho Apple Silicon" },
  { value: "large",          label: "Large (~3GB)",
    en: "Best accuracy · Slowest · Requires 8GB+ RAM",
    vi: "Chính xác nhất · Chậm nhất · Cần 8GB+ RAM" },
];

export const OLLAMA_MODEL_OPTIONS = [
  { value: "gemma3:1b",   label: "gemma3:1b",
    en: "~1GB RAM · Very fast · Basic quality",
    vi: "~1GB RAM · Rất nhanh · Chất lượng cơ bản" },
  { value: "llama3.2",    label: "llama3.2:3b",
    en: "~2GB RAM · Fast · Good quality",
    vi: "~2GB RAM · Nhanh · Chất lượng tốt" },
  { value: "gemma3:4b",   label: "gemma3:4b",
    en: "~3GB RAM · Fast · Quite good (recommended)",
    vi: "~3GB RAM · Nhanh · Khá tốt (khuyên dùng)" },
  { value: "llama3.1:8b", label: "llama3.1:8b",
    en: "~5GB RAM · Moderate · Good",
    vi: "~5GB RAM · Vừa · Tốt" },
  { value: "gemma3:12b",  label: "gemma3:12b",
    en: "~8GB RAM · Slower · Very good",
    vi: "~8GB RAM · Chậm hơn · Rất tốt" },
];

export const CONTEXT_PRESETS = [
  { value: "none",          labelKey: "contextNone",          text: "" },
  { value: "casual",        labelKey: "contextCasual",        text: "Context: casual everyday conversation, informal speech, colloquial expressions, slang." },
  { value: "business",      labelKey: "contextBusiness",      text: "Context: business meeting, sales, marketing, finance, planning, strategy, corporate language." },
  { value: "it",            labelKey: "contextIT",            text: "Context: technical software engineering discussion, code, architecture, debugging, API, commands." },
  { value: "news",          labelKey: "contextNews",          text: "Context: news broadcast or podcast, formal speech, proper nouns, place names, current events." },
  { value: "entertainment", labelKey: "contextEntertainment", text: "Context: entertainment content — movies, anime, TV shows, social media, pop culture, informal dialogue." },
  { value: "custom",        labelKey: "contextCustom",        text: "" },
];

