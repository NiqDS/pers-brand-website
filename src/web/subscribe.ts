import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { getConnInfo } from '@hono/node-server/conninfo';
import { z } from 'zod';
import {
  confirmSubscriberByToken,
  getSubscriberByToken,
  unsubscribeByToken,
  upsertPendingSubscriber,
} from '../db/queries.js';
import { buildConfirmationEmail, getTransport } from '../email/index.js';
import { page } from './layout.js';
import { rateLimit } from './rate-limit.js';

export const subscribeRoutes = new Hono();

const emailSchema = z.string().trim().toLowerCase().email().max(254);

function notice(
  c: Context,
  kind: 'ok' | 'err',
  title: string,
  body: string,
  status: ContentfulStatusCode = 200,
) {
  const content = `<div class="notice ${kind}"><h2>${title}</h2><p>${body}</p><p><a href="/">← Back to the site</a></p></div>`;
  return c.html(page(content, { title }), status);
}

function clientIp(c: Context): string {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  try {
    // getConnInfo needs the node-server binding; absent under app.request in tests.
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

subscribeRoutes.post('/subscribe', async (c) => {
  const ip = clientIp(c);
  const limit = rateLimit(`subscribe:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) {
    return notice(c, 'err', 'Slow down', `Too many attempts. Try again in ${limit.retryAfterSeconds}s.`, 429);
  }

  const body = await c.req.parseBody();
  const parsed = emailSchema.safeParse(body.email);
  if (!parsed.success) {
    // Invalid input — store nothing.
    return notice(c, 'err', 'Check your email address', 'That doesn’t look like a valid email address.', 400);
  }

  const email = parsed.data;
  const sub = upsertPendingSubscriber(email);

  // Only (re)send a confirmation for subscribers still awaiting opt-in.
  if (sub.status === 'pending') {
    await getTransport().send(buildConfirmationEmail(sub.email, sub.confirm_token));
  }

  return notice(
    c,
    'ok',
    'Almost there',
    'Check your inbox for a confirmation link. You’re not subscribed until you click it.',
  );
});

subscribeRoutes.get('/confirm', (c) => {
  const token = c.req.query('token') ?? '';
  const before = getSubscriberByToken(token);
  if (!before) {
    return notice(c, 'err', 'Invalid link', 'That confirmation link is not valid.', 404);
  }
  if (before.status === 'unsubscribed') {
    return notice(c, 'err', 'Unsubscribed', 'This address has unsubscribed and can’t be confirmed.', 409);
  }
  confirmSubscriberByToken(token);
  return notice(c, 'ok', 'Subscription confirmed', 'You’re on the list. The next weekly dispatch will land in your inbox.');
});

subscribeRoutes.get('/unsubscribe', (c) => {
  const token = c.req.query('token') ?? '';
  const sub = unsubscribeByToken(token);
  if (!sub) {
    return notice(c, 'err', 'Invalid link', 'That unsubscribe link is not valid.', 404);
  }
  return notice(c, 'ok', 'Unsubscribed', 'You won’t receive any more emails. Sorry to see you go.');
});
