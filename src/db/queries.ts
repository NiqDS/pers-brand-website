import { randomBytes } from 'node:crypto';
import { getDb } from './index.js';
import type {
  Arc,
  Delivery,
  DeliveryChannel,
  DeliveryStatus,
  Draft,
  Movement,
  Post,
  PostKind,
  Subscriber,
} from './types.js';

const now = (): string => new Date().toISOString();

/** URL-safe slug from a title, with a short random suffix to guarantee uniqueness. */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = randomBytes(3).toString('hex');
  return base ? `${base}-${suffix}` : suffix;
}

// ── Posts ──────────────────────────────────────────────────────────────────

export interface NewPost {
  slug?: string;
  kind: PostKind;
  title: string;
  body_md: string;
  theme?: string | null;
  status?: 'draft' | 'published';
}

export function insertPost(p: NewPost): Post {
  const slug = p.slug ?? slugify(p.title);
  const status = p.status ?? 'draft';
  const created = now();
  const publishedAt = status === 'published' ? created : null;
  const res = getDb()
    .prepare(
      `INSERT INTO posts (slug, kind, title, body_md, theme, status, created_at, published_at)
       VALUES ($slug, $kind, $title, $body, $theme, $status, $created, $published)`,
    )
    .run({
      slug,
      kind: p.kind,
      title: p.title,
      body: p.body_md,
      theme: p.theme ?? null,
      status,
      created,
      published: publishedAt,
    });
  return getPostById(Number(res.lastInsertRowid))!;
}

export function getPostById(id: number): Post | undefined {
  return getDb().prepare('SELECT * FROM posts WHERE id = $id').get({ id }) as Post | undefined;
}

export function getPostBySlug(slug: string): Post | undefined {
  return getDb().prepare('SELECT * FROM posts WHERE slug = $slug').get({ slug }) as
    | Post
    | undefined;
}

export function getPublishedPosts(): Post[] {
  return getDb()
    .prepare(
      `SELECT * FROM posts WHERE status = 'published'
       ORDER BY published_at DESC, id DESC`,
    )
    .all() as unknown as Post[];
}

export function getPublishedNotes(): Post[] {
  return getDb()
    .prepare(
      `SELECT * FROM posts WHERE status = 'published' AND kind = 'note'
       ORDER BY published_at DESC, id DESC`,
    )
    .all() as unknown as Post[];
}

export function publishPost(id: number): void {
  getDb()
    .prepare(`UPDATE posts SET status = 'published', published_at = $at WHERE id = $id`)
    .run({ id, at: now() });
}

// ── Subscribers ──────────────────────────────────────────────────────────────

export function makeToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Insert a pending subscriber, or return the existing row (idempotent by email). */
export function upsertPendingSubscriber(email: string): Subscriber {
  const existing = getSubscriberByEmail(email);
  if (existing) return existing;
  const token = makeToken();
  const res = getDb()
    .prepare(
      `INSERT INTO subscribers (email, status, confirm_token, created_at)
       VALUES ($email, 'pending', $token, $created)`,
    )
    .run({ email, token, created: now() });
  return getSubscriberById(Number(res.lastInsertRowid))!;
}

export function getSubscriberById(id: number): Subscriber | undefined {
  return getDb().prepare('SELECT * FROM subscribers WHERE id = $id').get({ id }) as
    | Subscriber
    | undefined;
}

export function getSubscriberByEmail(email: string): Subscriber | undefined {
  return getDb().prepare('SELECT * FROM subscribers WHERE email = $email').get({ email }) as
    | Subscriber
    | undefined;
}

export function getSubscriberByToken(token: string): Subscriber | undefined {
  return getDb()
    .prepare('SELECT * FROM subscribers WHERE confirm_token = $token')
    .get({ token }) as Subscriber | undefined;
}

/** Flip a pending subscriber to confirmed. Returns true if a row was updated. */
export function confirmSubscriberByToken(token: string): Subscriber | undefined {
  const sub = getSubscriberByToken(token);
  if (!sub || sub.status === 'unsubscribed') return undefined;
  getDb()
    .prepare(`UPDATE subscribers SET status = 'confirmed', confirmed_at = $at WHERE id = $id`)
    .run({ id: sub.id, at: now() });
  return getSubscriberById(sub.id);
}

export function unsubscribeByToken(token: string): Subscriber | undefined {
  const sub = getSubscriberByToken(token);
  if (!sub) return undefined;
  getDb()
    .prepare(`UPDATE subscribers SET status = 'unsubscribed' WHERE id = $id`)
    .run({ id: sub.id });
  return getSubscriberById(sub.id);
}

export function confirmedSubscribers(): Subscriber[] {
  return getDb()
    .prepare(`SELECT * FROM subscribers WHERE status = 'confirmed' ORDER BY id`)
    .all() as unknown as Subscriber[];
}

// ── Deliveries ───────────────────────────────────────────────────────────────

export function recordDelivery(
  postId: number,
  channel: DeliveryChannel,
  status: DeliveryStatus,
  detail?: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO deliveries (post_id, channel, status, detail, created_at)
       VALUES ($postId, $channel, $status, $detail, $created)`,
    )
    .run({ postId, channel, status, detail: detail ?? null, created: now() });
}

/** True if the post already has a successful send on this channel (idempotency guard). */
export function hasSuccessfulDelivery(postId: number, channel: DeliveryChannel): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS ok FROM deliveries
       WHERE post_id = $postId AND channel = $channel AND status = 'sent' LIMIT 1`,
    )
    .get({ postId, channel }) as { ok: number } | undefined;
  return row !== undefined;
}

export function getDeliveries(postId: number): Delivery[] {
  return getDb()
    .prepare('SELECT * FROM deliveries WHERE post_id = $postId ORDER BY id')
    .all({ postId }) as unknown as Delivery[];
}

// ── Arcs & drafts ────────────────────────────────────────────────────────────

export interface NewArc {
  week_number: number;
  topic: string;
  thesis: string;
  source_notes?: string;
  tease?: string;
}

export function insertArc(a: NewArc): Arc {
  const res = getDb()
    .prepare(
      `INSERT INTO arcs (week_number, topic, thesis, source_notes, tease, created_at)
       VALUES ($week, $topic, $thesis, $notes, $tease, $created)`,
    )
    .run({
      week: a.week_number,
      topic: a.topic,
      thesis: a.thesis,
      notes: a.source_notes ?? '',
      tease: a.tease ?? '',
      created: now(),
    });
  return getArc(Number(res.lastInsertRowid))!;
}

export function getArc(id: number): Arc | undefined {
  return getDb().prepare('SELECT * FROM arcs WHERE id = $id').get({ id }) as Arc | undefined;
}

export function getLatestArc(): Arc | undefined {
  return getDb().prepare('SELECT * FROM arcs ORDER BY id DESC LIMIT 1').get() as Arc | undefined;
}

export function linkArcToPost(arcId: number, postId: number): void {
  getDb().prepare('UPDATE arcs SET post_id = $postId WHERE id = $id').run({ id: arcId, postId });
}

export function publishArc(arcId: number): void {
  getDb()
    .prepare(`UPDATE arcs SET status = 'published', published_at = $at WHERE id = $id`)
    .run({ id: arcId, at: now() });
}

/** Insert or replace the draft for a given arc + movement. */
export function upsertDraft(arcId: number, movement: Movement, bodyMd: string): Draft {
  const wordCount = bodyMd.trim().split(/\s+/).filter(Boolean).length;
  getDb()
    .prepare(
      `INSERT INTO drafts (arc_id, movement, body_md, word_count, created_at)
       VALUES ($arc, $movement, $body, $wc, $created)
       ON CONFLICT (arc_id, movement)
       DO UPDATE SET body_md = excluded.body_md,
                     word_count = excluded.word_count,
                     created_at = excluded.created_at`,
    )
    .run({ arc: arcId, movement, body: bodyMd, wc: wordCount, created: now() });
  return getDraft(arcId, movement)!;
}

export function getDraft(arcId: number, movement: Movement): Draft | undefined {
  return getDb()
    .prepare('SELECT * FROM drafts WHERE arc_id = $arc AND movement = $movement')
    .get({ arc: arcId, movement }) as Draft | undefined;
}

export function getDrafts(arcId: number): Draft[] {
  return getDb()
    .prepare('SELECT * FROM drafts WHERE arc_id = $arc ORDER BY id')
    .all({ arc: arcId }) as unknown as Draft[];
}
