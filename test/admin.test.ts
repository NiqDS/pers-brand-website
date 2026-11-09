import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb } from '../src/db/index.js';
import {
  confirmSubscriberByToken,
  insertArc,
  upsertDraft,
  upsertPendingSubscriber,
} from '../src/db/queries.js';
import { setTransport, type EmailMessage, type Transport } from '../src/email/index.js';

const sent: EmailMessage[] = [];
const capture: Transport = {
  name: 'capture',
  async send(msg) {
    sent.push(msg);
  },
};

const app = createApp();
const TOKEN = 'test-token'; // matches vitest.config.ts env

beforeEach(() => {
  sent.length = 0;
  setTransport(capture);
});

afterAll(() => closeDb());

describe('admin routes', () => {
  it('rejects requests without the admin token', async () => {
    const res = await app.request('/admin/posts', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('creates a published post with the token', async () => {
    const res = await app.request('/admin/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-admin-token': TOKEN },
      body: new URLSearchParams({
        kind: 'note',
        title: 'A hand-written note',
        body_md: 'Just a **quick** thought.',
        publish: 'true',
      }).toString(),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { slug: string; status: string; url: string };
    expect(json.status).toBe('published');
    expect(json.url).toContain('/p/');
  });

  it('does not publish when the form sends publish=false', async () => {
    const res = await app.request('/admin/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-admin-token': TOKEN },
      body: new URLSearchParams({
        kind: 'note',
        title: 'A draft',
        body_md: 'Draft body.',
        publish: 'false',
      }).toString(),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('draft');
  });

  it('rejects admin tokens in query strings', async () => {
    const res = await app.request(`/admin/digest/run?token=${TOKEN}`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('sanitizes HTML authored in Markdown before publishing', async () => {
    const create = await app.request('/admin/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-admin-token': TOKEN },
      body: new URLSearchParams({
        kind: 'article',
        title: 'Sanitization test',
        body_md: '<img src=x onerror=alert(1)> <script>alert(2)</script>',
        publish: 'true',
      }).toString(),
    });
    const post = (await create.json()) as { slug: string };
    const page = await app.request(`/p/${post.slug}`);
    const html = await page.text();
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script>');
  });

  it('runs the weekly digest end-to-end (publish + deliver)', async () => {
    // Editor prepares an arc with drafts during the week (here: seeded directly).
    const arc = insertArc({
      week_number: 9,
      topic: 'The sovereign-AI money trail',
      thesis: 'State capital sets the terms.',
      source_notes: 'notes',
      tease: 'next',
    });
    upsertDraft(arc.id, 'fri-sub', '**Lede** — a concrete thing happened.\n\nFull analysis.');
    upsertDraft(arc.id, 'fri-li', '**Finding 1: $50B.** See the full piece: [SUBSTACK LINK]');
    const sub = upsertPendingSubscriber('reader@example.com');
    confirmSubscriberByToken(sub.confirm_token);

    const res = await app.request('/admin/digest/run', {
      method: 'POST',
      headers: { 'x-admin-token': TOKEN },
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as { ran: boolean; postSlug: string; delivery: string };
    expect(report.ran).toBe(true);
    expect(report.postSlug).toBeTruthy();
    expect(report.delivery).toBe('sent (1)');
    expect(sent).toHaveLength(1);

    // Re-running does not resend (idempotent delivery).
    const again = await app.request('/admin/digest/run', {
      method: 'POST',
      headers: { 'x-admin-token': TOKEN },
    });
    const report2 = (await again.json()) as { delivery: string };
    expect(report2.delivery).toBe('skipped (0)');
    expect(sent).toHaveLength(1);
  });
});
