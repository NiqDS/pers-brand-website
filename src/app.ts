import { Hono } from 'hono';
import { publicRoutes } from './web/public.js';
import { subscribeRoutes } from './web/subscribe.js';

/** Build the Hono app with all routes mounted. No server / no side effects, so
 *  it can be exercised directly in tests via `app.request(...)`. */
export function createApp(): Hono {
  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/', publicRoutes);
  app.route('/', subscribeRoutes);
  return app;
}
