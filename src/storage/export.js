import { getSession, getUtterances, getSpeakerAliases } from "./history.js";

export const EXPORT_FORMATS = {
  md: { ext: "md", mime: "text/markdown; charset=utf-8" },
  txt: { ext: "txt", mime: "text/plain; charset=utf-8" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
};

const LABELS = {
  en: {
    title: "Transcript",
    audioSource: "Audio source",
    targetLanguage: "Target language",
    duration: "Duration",
    device: "Device",
    content: "Content",
    speaker: "Speaker",
    time: "Time",
    original: "Original",
    translation: "Translation",
    exportedAt: "Exported at",
    minutes: "min",
    seconds: "sec",
  },
  vi: {
    title: "Phiên dịch",
    audioSource: "Nguồn âm thanh",
    targetLanguage: "Ngôn ngữ đích",
    duration: "Thời lượng",
    device: "Thiết bị",
    content: "Nội dung",
    speaker: "Người nói",
    time: "Thời gian",
    original: "Bản gốc",
    translation: "Bản dịch",
    exportedAt: "Xuất lúc",
    minutes: "phút",
    seconds: "giây",
  },
};

const LOCALES = { en: "en-US", vi: "vi-VN" };

// Same hues as the UI speaker palette (style.css), darkened to stay readable on white paper
const SPEAKER_COLORS = ["2563EB", "DB2777", "7C3AED", "059669", "D97706", "EA580C", "0891B2", "C026D3"];

export function normalizeExportOptions(query = {}) {
  const bool = (v, def) => (v === undefined ? def : v === "1" || v === "true");
  return {
    format: EXPORT_FORMATS[query.format] ? query.format : "md",
    content: ["both", "original", "translation"].includes(query.content) ? query.content : "both",
    // Plain text has no table form, so it always uses the chat layout
    layout: query.layout === "table" && query.format !== "txt" ? "table" : "chat",
    group: bool(query.group, false),
    timestamps: bool(query.timestamps, true),
    speakers: bool(query.speakers, true),
    metadata: bool(query.metadata, true),
    lang: LABELS[query.lang] ? query.lang : "vi",
  };
}

/**
 * Collects everything a renderer needs, so each format only deals with layout.
 */
function buildExportModel(sessionId, opts) {
  const session = getSession(sessionId);
  if (!session) return null;

  const L = LABELS[opts.lang];
  const locale = LOCALES[opts.lang];
  const utterances = getUtterances(sessionId);
  const aliases = Object.fromEntries(getSpeakerAliases(sessionId).map((a) => [a.speaker, a.alias]));
  const startTime = new Date(session.started_at + "Z");
  const endTime = session.ended_at ? new Date(session.ended_at + "Z") : null;

  const meta = [[L.audioSource, sourceLabel(session.audio_source)], [L.targetLanguage, session.target_language]];
  if (endTime) meta.push([L.duration, formatDuration(endTime - startTime, L)]);
  if (session.device_name) meta.push([L.device, session.device_name]);

  const speakerIds = [...new Set(utterances.map((u) => u.speaker).filter(Boolean))];

  const entries = [];
  for (const u of utterances) {
    let original = u.original_text;
    let translation = u.translated_text || "";
    if (opts.content === "original") translation = "";
    if (opts.content === "translation") {
      // Speech already in the target language has no translation; keep the original then
      original = translation || original;
      translation = "";
    }
    if (!original) continue;

    const speakerIndex = u.speaker ? speakerIds.indexOf(u.speaker) : -1;
    entries.push({
      speakerKey: u.speaker || "",
      time: formatTime(new Date(u.timestamp + "Z"), locale),
      speaker: u.speaker ? (aliases[u.speaker] || `${L.speaker} ${speakerIndex + 1}`) : L.speaker,
      speakerIndex,
      lang: opts.content === "translation" ? "" : (u.original_language || ""),
      original,
      translation,
    });
  }

  return {
    session,
    labels: L,
    entries: opts.group ? groupBySpeaker(entries) : entries,
    title: session.title || `${L.title} - ${formatDate(startTime, locale)}`,
    meta,
    exportedAt: formatDate(new Date(), locale),
    fileBase: buildFileBase(session, startTime),
  };
}

// Merges consecutive utterances of the same speaker into one paragraph, keeping the first timestamp
function groupBySpeaker(entries) {
  const join = (a, b) => [a, b].filter(Boolean).join(" ");
  const grouped = [];
  for (const e of entries) {
    const last = grouped[grouped.length - 1];
    if (last && last.speakerKey === e.speakerKey) {
      last.original = join(last.original, e.original);
      last.translation = join(last.translation, e.translation);
      if (last.lang !== e.lang) last.lang = "";
    } else {
      grouped.push({ ...e });
    }
  }
  return grouped;
}

function tableColumns(m, opts) {
  const L = m.labels;
  const cols = [];
  if (opts.timestamps) cols.push({ key: "time", label: L.time, width: 12 });
  if (opts.speakers) cols.push({ key: "speaker", label: L.speaker, width: 16 });
  const textWidth = 100 - cols.reduce((sum, c) => sum + c.width, 0);
  if (opts.content === "both") {
    cols.push({ key: "original", label: L.original, width: textWidth / 2 });
    cols.push({ key: "translation", label: L.translation, width: textWidth / 2 });
  } else {
    cols.push({ key: "original", label: opts.content === "translation" ? L.translation : L.original, width: textWidth });
  }
  return cols;
}

function entryHeader(e, opts) {
  const parts = [];
  if (opts.timestamps) parts.push(`[${e.time}]`);
  if (opts.speakers) parts.push(e.speaker);
  return parts.join(" ");
}

function renderMarkdown(m, opts) {
  const L = m.labels;
  let md = `# ${m.title}\n\n`;

  if (opts.metadata) {
    for (const [label, value] of m.meta) md += `**${label}**: ${value}  \n`;
    md += `\n---\n\n`;
  }
  md += `## ${L.content}\n\n`;

  if (opts.layout === "table") {
    const cols = tableColumns(m, opts);
    const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
    md += `| ${cols.map((c) => c.label).join(" | ")} |\n`;
    md += `| ${cols.map(() => "---").join(" | ")} |\n`;
    for (const e of m.entries) {
      const values = cols.map((c) => {
        if (c.key === "speaker") return `**${cell(e.speaker)}**${e.lang ? ` *(${e.lang})*` : ""}`;
        return cell(e[c.key]);
      });
      md += `| ${values.join(" | ")} |\n`;
    }
    md += `\n`;
  } else {
    for (const e of m.entries) {
      const header = entryHeader(e, opts);
      const lang = e.lang ? ` (${e.lang})` : "";
      if (header) md += `**${header}**${lang}:  \n`;
      md += `${e.original}  \n`;
      if (e.translation) md += `> *${e.translation}*  \n`;
      md += `\n`;
    }
  }

  md += `---\n\n*${L.exportedAt} ${m.exportedAt}*\n`;
  return md;
}

function renderText(m, opts) {
  const L = m.labels;
  let txt = `${m.title}\n${"=".repeat(m.title.length)}\n\n`;

  if (opts.metadata) {
    for (const [label, value] of m.meta) txt += `${label}: ${value}\n`;
    txt += `\n`;
  }

  for (const e of m.entries) {
    const header = entryHeader(e, opts);
    if (header) txt += `${header}${e.lang ? ` (${e.lang})` : ""}:\n`;
    txt += `${e.original}\n`;
    if (e.translation) txt += `  → ${e.translation}\n`;
    txt += `\n`;
  }

  txt += `${L.exportedAt} ${m.exportedAt}\n`;
  return txt;
}

async function renderDocx(m, opts) {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = docx;
  const L = m.labels;
  const children = [new Paragraph({ text: m.title, heading: HeadingLevel.TITLE })];

  if (opts.metadata) {
    for (const [label, value] of m.meta) {
      children.push(new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(String(value))],
      }));
    }
    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 4 } },
      spacing: { after: 200 },
    }));
  }

  children.push(new Paragraph({ text: L.content, heading: HeadingLevel.HEADING_1 }));

  if (opts.layout === "table") children.push(docxTable(docx, m, opts));
  else children.push(...docxChat(docx, m, opts));

  children.push(new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun({ text: `${L.exportedAt} ${m.exportedAt}`, italics: true, color: "888888", size: 18 })],
  }));

  const doc = new Document({
    creator: "Node Trans",
    title: m.title,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

function speakerColor(e) {
  return e.speakerIndex >= 0 ? SPEAKER_COLORS[e.speakerIndex % SPEAKER_COLORS.length] : "444444";
}

function docxChat({ Paragraph, TextRun }, m, opts) {
  const children = [];
  for (const e of m.entries) {
    const headerRuns = [];
    if (opts.timestamps) headerRuns.push(new TextRun({ text: `[${e.time}] `, color: "888888", size: 18 }));
    if (opts.speakers) {
      headerRuns.push(new TextRun({ text: e.speaker, bold: true, color: speakerColor(e) }));
    }
    if (headerRuns.length && e.lang) headerRuns.push(new TextRun({ text: ` (${e.lang})`, color: "888888", size: 18 }));
    if (headerRuns.length) children.push(new Paragraph({ spacing: { before: 160 }, keepNext: true, children: headerRuns }));

    children.push(new Paragraph({ spacing: { after: e.translation ? 20 : 80 }, children: [new TextRun(e.original)] }));
    if (e.translation) {
      children.push(new Paragraph({
        indent: { left: 360 },
        spacing: { after: 80 },
        children: [new TextRun({ text: e.translation, italics: true, color: "555555" })],
      }));
    }
  }
  return children;
}

function docxTable({ Table, TableRow, TableCell, Paragraph, TextRun, WidthType, ShadingType }, m, opts) {
  const cols = tableColumns(m, opts);
  const margins = { top: 60, bottom: 60, left: 100, right: 100 };

  const header = new TableRow({
    tableHeader: true,
    children: cols.map((c) => new TableCell({
      width: { size: c.width, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: "EEF2FF", color: "auto" },
      margins,
      children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true })] })],
    })),
  });

  const rows = m.entries.map((e) => new TableRow({
    cantSplit: true,
    children: cols.map((c) => {
      let runs;
      if (c.key === "speaker") {
        runs = [new TextRun({ text: e.speaker, bold: true, color: speakerColor(e) })];
        if (e.lang) runs.push(new TextRun({ text: ` (${e.lang})`, color: "888888", size: 18 }));
      } else if (c.key === "time") {
        runs = [new TextRun({ text: e.time, color: "888888", size: 18 })];
      } else if (c.key === "translation") {
        runs = [new TextRun({ text: e.translation, italics: true, color: "555555" })];
      } else {
        runs = [new TextRun(e.original)];
      }
      return new TableCell({
        width: { size: c.width, type: WidthType.PERCENTAGE },
        margins,
        children: [new Paragraph({ children: runs })],
      });
    }),
  }));

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

/**
 * @returns {Promise<{ body: string|Buffer, mime: string, filename: string } | null>}
 */
export async function exportSession(sessionId, opts) {
  const model = buildExportModel(sessionId, opts);
  if (!model) return null;

  const { ext, mime } = EXPORT_FORMATS[opts.format];
  let body;
  if (opts.format === "docx") body = await renderDocx(model, opts);
  else if (opts.format === "txt") body = renderText(model, opts);
  else body = renderMarkdown(model, opts);

  return { body, mime, filename: `${model.fileBase}.${ext}` };
}

/**
 * Exports several sessions as one zip. Missing session ids are skipped.
 * @returns {Promise<{ body: Buffer, mime: string, filename: string } | null>}
 */
export async function exportSessions(sessionIds, opts) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set();

  for (const id of sessionIds) {
    const result = await exportSession(id, opts);
    if (!result) continue;
    // Two sessions can share a title and start minute; keep both files
    let name = result.filename;
    for (let n = 2; used.has(name); n++) name = result.filename.replace(/(\.\w+)$/, ` (${n})$1`);
    used.add(name);
    zip.file(name, result.body);
  }
  if (used.size === 0) return null;

  const body = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    body,
    mime: "application/zip",
    filename: `node-trans_export_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`,
  };
}

function buildFileBase(session, startTime) {
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${startTime.getFullYear()}-${pad(startTime.getMonth() + 1)}-${pad(startTime.getDate())}_${pad(startTime.getHours())}${pad(startTime.getMinutes())}`;
  const title = (session.title || "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return title ? `${title}_${stamp}` : `node-trans_${stamp}`;
}

function sourceLabel(source) {
  switch (source) {
    case "mic": return "Microphone";
    case "system": return "System Audio";
    case "both": return "Mic + System";
    default: return source;
  }
}

function formatDate(d, locale) {
  // Date and time formatted separately: vi-VN's combined style puts "lúc <time>" first
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${d.toLocaleDateString(locale, { dateStyle: "long" })}, ${time}`;
}

function formatTime(d, locale) {
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(ms, L) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} ${L.minutes}`;
  return `${seconds} ${L.seconds}`;
}
