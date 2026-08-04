import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { seedIfEmpty } from './db/seed.js';
import { publicRoutes } from './web/public.js';

// Open the DB, apply migrations, and seed sample content on first boot.
getDb();
seedIfEmpty();

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));
app.route('/', publicRoutes);

// Subscriptions and admin routes are mounted in later milestones.

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
