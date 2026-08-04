import { serve } from '@hono/node-server';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { seedIfEmpty } from './db/seed.js';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { registerDefaultPublishers } from './publishers/index.js';

// Open the DB, apply migrations, and seed sample content on first boot.
getDb();
seedIfEmpty();
await registerDefaultPublishers();

const app = createApp();
startScheduler();

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
