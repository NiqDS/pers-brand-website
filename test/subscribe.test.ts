import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb } from '../src/db/index.js';
import { getSubscriberByEmail } from '../src/db/queries.js';
import { setTransport, type EmailMessage, type Transport } from '../src/email/index.js';
import { resetRateLimit } from '../src/web/rate-limit.js';

const sent: EmailMessage[] = [];
const capture: Transport = {
  name: 'capture',
  async send(msg) {
    sent.push(msg);
  },
};

const app = createApp();

beforeEach(() => {
  sent.length = 0;
  resetRateLimit();
  setTransport(capture);
});

afterAll(() => closeDb());

function form(email: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email }).toString(),
  };
}

function tokenFrom(msg: EmailMessage): string {
  const m = msg.text.match(/\/confirm\?token=([^\s]+)/);
  return decodeURIComponent(m![1]!);
}

describe('subscribe → confirm → unsubscribe', () => {
  it('rejects an invalid email and stores nothing', async () => {
    const res = await app.request('/subscribe', form('not-an-email'));
    expect(res.status).toBe(400);
    expect(getSubscriberByEmail('not-an-email')).toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('creates a pending subscriber and emails a confirmation link', async () => {
    const res = await app.request('/subscribe', form('alice@example.com'));
    expect(res.status).toBe(200);
    const sub = getSubscriberByEmail('alice@example.com');
    expect(sub?.status).toBe('pending');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('alice@example.com');
  });

  it('confirms via the token, then unsubscribes', async () => {
    await app.request('/subscribe', form('bob@example.com'));
    const token = tokenFrom(sent[0]!);

    const confirmRes = await app.request(`/confirm?token=${encodeURIComponent(token)}`);
    expect(confirmRes.status).toBe(200);
    expect(getSubscriberByEmail('bob@example.com')?.status).toBe('confirmed');

    const unsubRes = await app.request(`/unsubscribe?token=${encodeURIComponent(token)}`);
    expect(unsubRes.status).toBe(200);
    expect(getSubscriberByEmail('bob@example.com')?.status).toBe('unsubscribed');
  });

  it('rate-limits repeated attempts from the same IP', async () => {
    const headers = { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '203.0.113.9' };
    for (let i = 0; i < 5; i++) {
      const r = await app.request('/subscribe', {
        method: 'POST',
        headers,
        body: new URLSearchParams({ email: `u${i}@example.com` }).toString(),
      });
      expect(r.status).toBe(200);
    }
    const sixth = await app.request('/subscribe', {
      method: 'POST',
      headers,
      body: new URLSearchParams({ email: 'u6@example.com' }).toString(),
    });
    expect(sixth.status).toBe(429);
  });
});
