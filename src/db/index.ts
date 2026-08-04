import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { config } from '../config.js';
import { runMigrations } from './migrate.js';

// node:sqlite is a Node 22 builtin newer than some bundlers' builtins lists.
// Load its value via require so tooling (Vite/Vitest) never tries to bundle it;
// the type is imported type-only above and erased at build time.
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

let db: DatabaseSyncType | null = null;

/**
 * Open (once) and return the SQLite connection, applying any pending
 * migrations on first use. The connection is process-wide and synchronous —
 * node:sqlite is a single-file, zero-native-dep store, ideal at this size.
 */
export function getDb(): DatabaseSyncType {
  if (db) return db;

  if (config.DATABASE_PATH !== ':memory:') {
    mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });
  }

  const conn = new DatabaseSync(config.DATABASE_PATH);
  conn.exec('PRAGMA journal_mode = WAL');
  conn.exec('PRAGMA foreign_keys = ON');
  runMigrations(conn);
  db = conn;
  return db;
}

/** Close the connection (used by tests and graceful shutdown). */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
