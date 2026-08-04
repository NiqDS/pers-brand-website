import type { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Apply `migrations/*.sql` in filename order, recording each applied file in a
 * `_migrations` table so it never runs twice. Each migration runs in its own
 * transaction — a failure rolls back cleanly and stops the run.
 */
export function runMigrations(conn: DatabaseSync): void {
  conn.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name       TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const applied = new Set(
    conn.prepare('SELECT name FROM _migrations').all().map((r) => (r as { name: string }).name),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const insert = conn.prepare('INSERT INTO _migrations (name, applied_at) VALUES ($name, $at)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    conn.exec('BEGIN');
    try {
      conn.exec(sql);
      insert.run({ name: file, at: new Date().toISOString() });
      conn.exec('COMMIT');
      console.log(`migration applied: ${file}`);
    } catch (err) {
      conn.exec('ROLLBACK');
      throw new Error(`migration failed: ${file}: ${(err as Error).message}`);
    }
  }
}
