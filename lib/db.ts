import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// One small SQLite file. On serverless hosts only /tmp is writable.
const file = process.env.VERCEL ? "/tmp/accel.db" : path.join(process.cwd(), "data", "app.db");

declare global {
  var __accelDb: DatabaseSync | undefined;
}

function open() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, lang TEXT, business TEXT, gstin_masked TEXT,
      profile TEXT NOT NULL, lines TEXT NOT NULL, contract INTEGER NOT NULL, monthly INTEGER NOT NULL, setup INTEGER NOT NULL,
      consent_id TEXT, kyc_verdict TEXT, slot TEXT, offset_hours REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, lang TEXT, kind TEXT, stage TEXT, profile TEXT NOT NULL,
      monthly INTEGER, score REAL, status TEXT NOT NULL DEFAULT 'new', assigned TEXT, note TEXT
    );
    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, purposes TEXT NOT NULL, notice_version TEXT NOT NULL, lang TEXT, withdrawn_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, type TEXT NOT NULL, ref TEXT, data TEXT
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY, order_id TEXT, created_at INTEGER NOT NULL, text TEXT
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, state TEXT NOT NULL
    );
  `);
  // Storage limitation: enforce retention on every start
  const day = 86_400_000;
  db.prepare("DELETE FROM chat_sessions WHERE updated_at < ?").run(Date.now() - 30 * day);
  db.prepare("DELETE FROM leads WHERE created_at < ? AND status != 'converted'").run(Date.now() - 90 * day);
  db.prepare("DELETE FROM events WHERE at < ?").run(Date.now() - 365 * day);
  return db;
}

export function db(): DatabaseSync {
  if (!globalThis.__accelDb) globalThis.__accelDb = open();
  return globalThis.__accelDb;
}

export function newId(prefix: string, len = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${s}`;
}

/** Audit trail with identifiers already masked by the caller — never raw documents. */
export function logEvent(type: string, ref?: string, data?: unknown) {
  db().prepare("INSERT INTO events (at, type, ref, data) VALUES (?, ?, ?, ?)").run(Date.now(), type, ref ?? null, data ? JSON.stringify(data) : null);
}
