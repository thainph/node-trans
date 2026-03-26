import initSqlJs from "sql.js";
import path from "path";
import os from "os";
import fs from "fs";

const SQL = await initSqlJs();

const CONFIG_DIR = path.join(os.homedir(), ".node-trans");
const DB_PATH = path.join(CONFIG_DIR, "history.db");

let db;

function save() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// Helper: run parameterized SELECT, return all rows as objects
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run parameterized SELECT, return first row as object or undefined
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return row;
}

// Helper: run parameterized mutation, persist to disk
function run(sql, params = []) {
  db.run(sql, params);
  save();
}

export function getDb() {
  if (db) return db;

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      audio_source TEXT NOT NULL,
      target_language TEXT NOT NULL DEFAULT 'vi',
      device_name TEXT
    );

    CREATE TABLE IF NOT EXISTS utterances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      speaker TEXT,
      original_text TEXT NOT NULL,
      original_language TEXT,
      translated_text TEXT,
      translation_language TEXT,
      source TEXT DEFAULT 'mic',
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS speaker_aliases (
      session_id INTEGER NOT NULL,
      speaker TEXT NOT NULL,
      alias TEXT NOT NULL,
      PRIMARY KEY (session_id, speaker),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);

  // Migrate: add title column if missing
  const cols = all("PRAGMA table_info(sessions)");
  if (!cols.some((c) => c.name === "title")) {
    db.run("ALTER TABLE sessions ADD COLUMN title TEXT");
  }

  save();
  return db;
}

export function createSession(audioSource, targetLanguage, deviceName) {
  getDb();
  db.run(
    "INSERT INTO sessions (audio_source, target_language, device_name) VALUES (?, ?, ?)",
    [audioSource, targetLanguage, deviceName || null]
  );
  const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  save();
  return lastId;
}

export function endSession(sessionId) {
  getDb();
  run("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?", [sessionId]);
}

export function reopenSession(sessionId) {
  getDb();
  run("UPDATE sessions SET ended_at = NULL WHERE id = ?", [sessionId]);
}

export function addUtterance(sessionId, data) {
  getDb();
  run(
    `INSERT INTO utterances (session_id, speaker, original_text, original_language, translated_text, translation_language, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      data.speaker || null,
      data.originalText,
      data.originalLanguage || null,
      data.translatedText || null,
      data.translationLanguage || null,
      data.source || "mic",
    ]
  );
}

export function getSessions(limit = 50, offset = 0) {
  getDb();
  return all(
    `SELECT s.*,
      (SELECT COUNT(*) FROM utterances u WHERE u.session_id = s.id) AS utterance_count,
      (SELECT COUNT(DISTINCT u.speaker) FROM utterances u WHERE u.session_id = s.id AND u.speaker IS NOT NULL) AS speaker_count
    FROM sessions s
    ORDER BY s.started_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

export function getSession(sessionId) {
  getDb();
  return get("SELECT * FROM sessions WHERE id = ?", [sessionId]);
}

export function getSpeakerAliases(sessionId) {
  getDb();
  return all("SELECT speaker, alias FROM speaker_aliases WHERE session_id = ?", [sessionId]);
}

export function setSpeakerAlias(sessionId, speaker, alias) {
  getDb();
  run(
    "INSERT INTO speaker_aliases (session_id, speaker, alias) VALUES (?, ?, ?) ON CONFLICT(session_id, speaker) DO UPDATE SET alias = ?",
    [sessionId, speaker, alias, alias]
  );
}

export function getUtterances(sessionId) {
  getDb();
  return all(
    "SELECT * FROM utterances WHERE session_id = ? ORDER BY timestamp ASC",
    [sessionId]
  );
}

export function renameSession(sessionId, title) {
  getDb();
  run("UPDATE sessions SET title = ? WHERE id = ?", [title, sessionId]);
}

export function deleteSession(sessionId) {
  getDb();
  db.run("DELETE FROM speaker_aliases WHERE session_id = ?", [sessionId]);
  db.run("DELETE FROM utterances WHERE session_id = ?", [sessionId]);
  db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
  save();
}
