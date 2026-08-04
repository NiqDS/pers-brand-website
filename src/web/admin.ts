import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { z } from 'zod';
import { config } from '../config.js';
import { insertArc, insertPost } from '../db/queries.js';
import { runWeeklyJob } from '../newsletter/run.js';

export const adminRoutes = new Hono();

/** Gate every /admin route behind ADMIN_TOKEN (header or ?token=). */
adminRoutes.use('/admin/*', async (c: Context, next: Next) => {
  const provided = c.req.header('x-admin-token') ?? c.req.query('token') ?? '';
  if (provided !== config.ADMIN_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

const postSchema = z.object({
  kind: z.enum(['article', 'note']),
  title: z.string().trim().min(1),
  body_md: z.string().min(1),
  publish: z.coerce.boolean().optional(),
});

// Create/publish an article or note by hand (markdown in, slug auto-generated).
adminRoutes.post('/admin/posts', async (c) => {
  const parsed = postSchema.safeParse(await c.req.parseBody());
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }
  const { kind, title, body_md, publish } = parsed.data;
  const post = insertPost({
    kind,
    title,
    body_md,
    status: publish ? 'published' : 'draft',
  });
  return c.json({ id: post.id, slug: post.slug, status: post.status, url: `${config.BASE_URL}/p/${post.slug}` }, 201);
});

const arcSchema = z.object({
  week_number: z.coerce.number().int().positive(),
  topic: z.string().trim().min(1),
  thesis: z.string().trim().min(1),
  source_notes: z.string().optional(),
  tease: z.string().optional(),
});

// Seed the weekly arc the scheduler / digest run will pick up.
adminRoutes.post('/admin/arcs', async (c) => {
  const parsed = arcSchema.safeParse(await c.req.parseBody());
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400);
  }
  const arc = insertArc(parsed.data);
  return c.json({ id: arc.id, week_number: arc.week_number, topic: arc.topic }, 201);
});

// Trigger the weekly generate -> publish -> deliver -> external pipeline now.
adminRoutes.post('/admin/digest/run', async (c) => {
  const report = await runWeeklyJob();
  return c.json(report);
});
