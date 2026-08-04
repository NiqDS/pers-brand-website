import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDb } from '../src/db/index.js';
import { getDeliveries, insertPost } from '../src/db/queries.js';
import { registerPublisher, publishPost } from '../src/publishers/index.js';
import { substackPublisher } from '../src/publishers/substack.js';
import { linkedinPublisher } from '../src/publishers/linkedin.js';

afterAll(() => closeDb());

const fakePost = () =>
  insertPost({ kind: 'digest', title: 'Week 3 — Test', body_md: 'body', status: 'published' });

describe('publishers degrade gracefully without credentials', () => {
  it('substack falls back to RSS when no post-by-email address is set', async () => {
    const r = await substackPublisher.publish(fakePost());
    expect(r.channel).toBe('substack');
    expect(r.status).toBe('skipped');
    expect(r.detail).toMatch(/RSS/);
  });

  it('linkedin reports missing credentials rather than throwing', async () => {
    const r = await linkedinPublisher.publish(fakePost());
    expect(r.channel).toBe('linkedin');
    expect(r.status).toBe('failed');
    expect(r.detail).toBe('no LinkedIn credentials');
  });

  it('publishPost runs all publishers, records deliveries, and never throws', async () => {
    registerPublisher(substackPublisher);
    registerPublisher(linkedinPublisher);
    const post = fakePost();
    const results = await publishPost(post);
    expect(results.map((r) => r.channel).sort()).toEqual(['linkedin', 'substack']);
    const channels = getDeliveries(post.id).map((d) => d.channel);
    expect(channels).toContain('substack');
    expect(channels).toContain('linkedin');
  });
});

describe('rss feed', () => {
  it('serves an RSS 2.0 feed of published posts', async () => {
    const post = insertPost({
      kind: 'article',
      title: 'A feed item',
      body_md: 'Body **content**.',
      status: 'published',
    });
    const res = await createApp().request('/rss.xml');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/rss\+xml/);
    const body = await res.text();
    expect(body).toContain('<rss version="2.0">');
    expect(body).toContain('A feed item');
    expect(body).toContain(`/p/${post.slug}`);
  });
});
