import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb } from '../src/db/index.js';
import {
  confirmSubscriberByToken,
  getArc,
  insertArc,
  upsertDraft,
  upsertPendingSubscriber,
} from '../src/db/queries.js';
import { publishArcArticle } from '../src/pipeline/generate.js';
import { deliverArcRoundup } from '../src/newsletter/deliver.js';
import { setTransport, type EmailMessage, type Transport } from '../src/email/index.js';

const sent: EmailMessage[] = [];
const capture: Transport = {
  name: 'capture',
  async send(msg) {
    sent.push(msg);
  },
};

beforeEach(() => {
  sent.length = 0;
  setTransport(capture);
});

afterAll(() => closeDb());

function confirm(email: string) {
  const sub = upsertPendingSubscriber(email);
  confirmSubscriberByToken(sub.confirm_token);
}

describe('weekly arc roundup delivery', () => {
  it('sends one email per confirmed subscriber and does not resend', async () => {
    confirm('a@example.com');
    confirm('b@example.com');
    upsertPendingSubscriber('pending@example.com'); // not confirmed — should be skipped

    const created = insertArc({
      week_number: 7,
      topic: 'Sovereign AI money trail',
      thesis: 'State capital is reshaping the model stack.',
      source_notes: 'notes',
      tease: 'next week',
    });
    upsertDraft(
      created.id,
      'fri-li',
      '**Finding 1: $50B committed.** Details. The full analysis is in this week’s Substack: [SUBSTACK LINK]',
    );
    const post = publishArcArticle(created, '**Lede** — full article body.');
    const arc = getArc(created.id)!;

    const first = await deliverArcRoundup(arc);
    expect(first.status).toBe('sent');
    expect(first.recipients).toBe(2);
    expect(sent).toHaveLength(2);
    expect(sent.map((m) => m.to).sort()).toEqual(['a@example.com', 'b@example.com']);
    // The [SUBSTACK LINK] placeholder was replaced with the on-site post URL.
    expect(sent[0]!.text).toContain(`/p/${post.slug}`);
    expect(sent[0]!.text).not.toContain('[SUBSTACK LINK]');

    // Re-running must not resend.
    const second = await deliverArcRoundup(getArc(created.id)!);
    expect(second.status).toBe('skipped');
    expect(sent).toHaveLength(2);
  });
});
