import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '../src/db/index.js';
import {
  confirmSubscriberByToken,
  confirmedSubscribers,
  getPostBySlug,
  insertPost,
  upsertPendingSubscriber,
} from '../src/db/queries.js';

afterAll(() => closeDb());

describe('posts', () => {
  it('inserts and reads back a post by slug', () => {
    const created = insertPost({
      kind: 'article',
      title: 'Who controls AI in finance?',
      body_md: '# Heading\n\nSome **markdown** body.',
      status: 'published',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.status).toBe('published');
    expect(created.published_at).not.toBeNull();

    const fetched = getPostBySlug(created.slug);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe('Who controls AI in finance?');
    expect(fetched!.body_md).toContain('**markdown**');
  });
});

describe('subscribers', () => {
  it('runs the pending -> confirmed flow', () => {
    const sub = upsertPendingSubscriber('reader@example.com');
    expect(sub.status).toBe('pending');
    expect(confirmedSubscribers()).toHaveLength(0);

    const confirmed = confirmSubscriberByToken(sub.confirm_token);
    expect(confirmed?.status).toBe('confirmed');
    expect(confirmedSubscribers().map((s) => s.email)).toContain('reader@example.com');
  });
});
