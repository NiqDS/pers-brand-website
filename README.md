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

## The weekly content pipeline

The engine is the **Digital Economics weekly arc**, ported from the content
pipeline you already use. Each week is one topic + thesis + source notes, which
expand into four grounded drafts and an editorial brief:

| Movement | Where | Length | Role |
| -------- | ------ | ------ | ---- |
| Tue LinkedIn | `tue` | ~400w | The Question |
| Thu LinkedIn | `thu` | ~850w | The Evidence |
| Fri LinkedIn | `fri-li` | ~500w | Preview + Results (drives to Substack) |
| **Fri Substack** | `fri-sub` | ~2100w | Full Article → published as a digest post |
| Editorial brief | `brief` | — | Planning brief for the week |

Generation is **source-note driven** (your research grounds every draft) — there
is no autonomous "generate from nothing." A claim validator checks any draft's
factual claims against the source notes.

### Generate a week from the CLI

```bash
# Preview all movements without saving (needs ANTHROPIC_API_KEY):
npm run digest:once -- --dry-run \
  --week 4 --topic "Who controls AI in finance?" \
  --thesis "Compute concentration is a control story." \
  --sources "\$588.8B wiped in a day; Nvidia; Goldman Sachs…" \
  --tease "The sovereign-AI money trail"

# Or pass a JSON file: { week, topic, thesis, sources, tease }
npm run digest:once -- --input week4.json          # generate + save + publish
npm run digest:once -- --input week4.json --no-publish
npm run digest:once -- --sources-file notes.md --topic "…" --thesis "…"
```

Without `--dry-run`, the arc and its drafts are saved, and the Friday article is
published as a digest post. Without an API key, the command exits with a clear,
friendly message.

### Or drive it over HTTP (admin, token-gated)

All `/admin/*` routes require `ADMIN_TOKEN` via the `x-admin-token` header or
`?token=`:

```bash
# Seed the week's arc:
curl -X POST localhost:3000/admin/arcs -H "x-admin-token: $ADMIN_TOKEN" \
  -d week_number=4 -d topic="…" -d thesis="…" -d source_notes="…" -d tease="…"

# Publish a hand-written article/note:
curl -X POST localhost:3000/admin/posts -H "x-admin-token: $ADMIN_TOKEN" \
  -d kind=note -d title="…" -d body_md="…" -d publish=true

# Run the weekly pipeline now (generate → publish → email → external):
curl -X POST "localhost:3000/admin/digest/run?token=$ADMIN_TOKEN"
```

## Newsletter

Subscribers opt in via the site (double opt-in). When the weekly job runs, the
**arc roundup** — the three findings plus a link to the full piece on your
site — is emailed to every confirmed subscriber, exactly once (idempotent via
the `deliveries` table). Console transport in dev; set `RESEND_API_KEY` for
production sends.

## Publishing to Substack & LinkedIn

The Friday article is your source of truth; it syndicates outward.

- **Substack — RSS import (recommended).** The site exposes `GET /rss.xml`. In
  Substack, create a publication and set it up to **import from RSS**, pointing
  at `https://your-domain/rss.xml`. New posts then flow in automatically; the
  Substack publisher simply confirms the post is in the feed and logs
  `skipped: served via RSS`. There is **no official Substack write API** — we do
  not scrape the dashboard or pretend one exists.
  - *Optional email-to-publish:* set `SUBSTACK_POST_EMAIL` to your Substack
    post-by-email address and the publisher will email the post there instead.

- **LinkedIn — official API.** Posts a short teaser + link back to your site via
  the Posts API (`POST /rest/posts`). Requires: creating a **LinkedIn app**, OAuth
  2.0 three-legged auth with the `w_member_social` scope (or the organization
  equivalent for a company page), and an author URN. Set `LINKEDIN_ACCESS_TOKEN`,
  `LINKEDIN_REFRESH_TOKEN`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and
  `LINKEDIN_AUTHOR_URN`. Token refresh is handled in-process.
  - **Reality check:** some post scopes require LinkedIn's **app review /
    approval** before they work in production. Until credentials are set, the
    publisher degrades gracefully — it logs `failed: no LinkedIn credentials` and
    never blocks the email send or the rest of the run.

Each publisher is isolated: a failure is logged to `deliveries` and never blocks
the others.

## Schedule & deploy

The weekly job (`generate → publish → email → external`) runs in-process via
`croner` at `DIGEST_CRON` in `DIGEST_TZ` (default: Fridays 07:00 Europe/London)
when `SCHEDULER_ENABLED=true`.

**Deploy (keep it boring):** a single container or Node host (Railway, Render,
Fly, a small VPS). SQLite lives on a persistent volume (`DATABASE_PATH`). On a
host that may sleep the process, prefer the **platform scheduler / a system
cron** hitting `POST /admin/digest/run` over the in-process `croner`; keep
`croner` for always-on hosts. Both are supported.

## Tests & CI

`npm run test` (Vitest) covers db functions, the subscribe/confirm/unsubscribe
flow, pipeline generation + validator parsing (Anthropic SDK mocked — no real
API calls), idempotent delivery, and each publisher's no-credentials path. A
GitHub Actions workflow runs install → `tsc --noEmit` → lint → `vitest run` on
every push and PR.

## Status — all milestones complete

- **M0** — skeleton, config, `/health`.
- **M1** — storage + migrations.
- **M2** — public site (home / post / notes).
- **M3** — subscriptions (double opt-in).
- **M4** — content pipeline (weekly arc from source notes).
- **M5** — email delivery (weekly arc roundup).
- **M6** — scheduler + admin.
- **M7** — Substack + LinkedIn publishers, RSS feed, CI.
