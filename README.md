# Digital Economics — publishing site + weekly newsletter engine

A small, self-hosted web publication for **Digital Economics** (AI, Finance &
Financial Literacy). It has a public site where articles, notes, and the weekly
digest live; visitors subscribe to a newsletter; and a content pipeline turns a
week's topic + source notes into the four-part editorial arc
(Tue / Thu / Fri LinkedIn + Friday Substack article) using the Claude API.

One deployable Node process. SQLite on disk. Cheap and simple to run.

## Stack

- **TypeScript on Node 22+** — uses the built-in `node:sqlite` (no native build step).
- **Hono** (`hono` + `@hono/node-server`) for the web app, server-rendered HTML.
- **SQLite** via `node:sqlite`, behind a small `db/` module.
- **`croner`** for the in-process weekly schedule.
- **`@anthropic-ai/sdk`** for the content pipeline (model set via `ANTHROPIC_MODEL`).
- **Email**: console transport (dev) or Resend (prod), selected by env.
- ESLint + Prettier + `tsc --noEmit`; Vitest for tests.

## Run locally

```bash
npm install
cp .env.example .env      # fill ANTHROPIC_API_KEY to enable the pipeline
npm run dev               # web app at http://localhost:3000
```

`GET /health` returns `{ "ok": true }` once the server is up.

## Scripts

| Script                | What it does                                            |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | Start the server with `tsx watch` (reloads on change). |
| `npm run typecheck`   | `tsc --noEmit`.                                         |
| `npm run lint`        | ESLint.                                                 |
| `npm run test`        | Vitest.                                                 |
| `npm run digest:once` | Generate one weekly arc from source notes (M4).        |

## Configuration

All configuration is via environment variables, validated with zod at startup
(missing/invalid required vars fail fast with a clear message). See
`.env.example` for the full list. Secrets live only in `.env` (gitignored) — the
example file ships with empty values.

## Status

Built milestone by milestone. See the tasks/commits for progress:

- **M0** — skeleton, config, `/health`. ✅
- M1 — storage + migrations.
- M2 — public site (home / post / notes).
- M3 — subscriptions (double opt-in).
- M4 — content pipeline (weekly arc from source notes).
- M5 — email delivery (weekly arc roundup).
- M6 — scheduler + admin.
- M7 — Substack + LinkedIn publishers + CI.
