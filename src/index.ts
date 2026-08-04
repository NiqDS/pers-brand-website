import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { config } from './config.js';
import { getDb } from './db/index.js';

// Open the DB and apply migrations on boot so the schema is ready before traffic.
getDb();

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));

// Feature routes are mounted in later milestones (public site, subscriptions, admin).

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`${config.SITE_NAME} listening on http://localhost:${info.port}`);
});

// Graceful shutdown so the dev watcher and containers exit cleanly.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close();
    process.exit(0);
  });
}

export { app };
