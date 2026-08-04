import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { getPostBySlug, getPublishedNotes, getPublishedPosts } from '../db/queries.js';
import { page } from './layout.js';
import { renderHome, renderNotes, renderPost } from './pages.js';

const stylesheet = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'styles.css'), 'utf8');

export const publicRoutes = new Hono();

publicRoutes.get('/styles.css', (c) => {
  c.header('Content-Type', 'text/css; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.body(stylesheet);
});

publicRoutes.get('/', (c) => {
  return c.html(page(renderHome(getPublishedPosts()), { title: undefined }));
});

publicRoutes.get('/notes', (c) => {
  return c.html(page(renderNotes(getPublishedNotes()), { title: 'Notes' }));
});

publicRoutes.get('/p/:slug', (c) => {
  const post = getPostBySlug(c.req.param('slug'));
  if (!post || post.status !== 'published') {
    return c.html(page('<div class="notice err"><p>That post could not be found.</p></div>', { title: 'Not found' }), 404);
  }
  return c.html(page(renderPost(post), { title: post.title, description: post.title }));
});
