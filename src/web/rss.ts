import { Hono } from 'hono';
import { config } from '../config.js';
import { getPublishedPosts } from '../db/queries.js';
import { mdToHtml } from './markdown.js';

export const rssRoutes = new Hono();

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rfc822(iso: string | null): string {
  return new Date(iso ?? Date.now()).toUTCString();
}

/**
 * RSS 2.0 feed of published posts. This is the Substack import path: point an
 * RSS-import publication at this URL and new posts flow through automatically.
 */
rssRoutes.get('/rss.xml', (c) => {
  const posts = getPublishedPosts();
  const items = posts
    .map((p) => {
      const url = `${config.BASE_URL}/p/${p.slug}`;
      return `    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${rfc822(p.published_at)}</pubDate>
      <description><![CDATA[${mdToHtml(p.body_md)}]]></description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(config.SITE_NAME)}</title>
    <link>${xmlEscape(config.BASE_URL)}</link>
    <description>${xmlEscape(config.SITE_TAGLINE)}</description>
    <language>en</language>
    <lastBuildDate>${rfc822(posts[0]?.published_at ?? null)}</lastBuildDate>
${items}
  </channel>
</rss>`;

  c.header('Content-Type', 'application/rss+xml; charset=utf-8');
  return c.body(xml);
});
