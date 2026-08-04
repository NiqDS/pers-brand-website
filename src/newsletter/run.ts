import { hasAnthropicKey } from '../config.js';
import { getArc, getDraft, getLatestArc, getPostById } from '../db/queries.js';
import { generateArc, publishArcArticle } from '../pipeline/generate.js';
import { publishPost as publishExternal } from '../publishers/index.js';
import { deliverArcRoundup } from './deliver.js';

export interface WeeklyRunReport {
  ran: boolean;
  arcId?: number;
  postSlug?: string;
  delivery?: string;
  external?: string[];
  note?: string;
}

/**
 * The weekly pipeline: take the latest arc the editor has prepared, make sure
 * its drafts exist (generate from its source notes if not), publish the Friday
 * article as a digest post, email the roundup to confirmed subscribers, and
 * push to external channels. Each step is idempotent, so a re-run after a crash
 * neither duplicates the post nor double-sends.
 *
 * This does NOT fabricate an arc from nothing — the editorial model is
 * source-note driven. If there's no arc to work with, it's a no-op.
 */
export async function runWeeklyJob(): Promise<WeeklyRunReport> {
  const latest = getLatestArc();
  if (!latest) {
    return { ran: false, note: 'no arc prepared — create one via the CLI or /admin/arcs' };
  }

  // Ensure the drafts exist (generate from stored source notes if missing).
  if (!getDraft(latest.id, 'fri-sub')) {
    if (!hasAnthropicKey()) {
      return {
        ran: false,
        arcId: latest.id,
        note: 'arc has no drafts and ANTHROPIC_API_KEY is unset — cannot generate',
      };
    }
    await generateArc(latest.id);
  }

  // Publish the Friday article as a digest post (once).
  let post = latest.post_id ? getPostById(latest.post_id) : undefined;
  if (!post) {
    const article = getDraft(latest.id, 'fri-sub');
    if (!article) return { ran: false, arcId: latest.id, note: 'no Friday article draft' };
    post = publishArcArticle(latest, article.body_md);
  }

  // Deliver the roundup (idempotent) and push to external channels.
  const arc = getArc(latest.id)!;
  const delivery = await deliverArcRoundup(arc);
  const external = await publishExternal(post);

  return {
    ran: true,
    arcId: arc.id,
    postSlug: post.slug,
    delivery: `${delivery.status} (${delivery.recipients})`,
    external: external.map((r) => `${r.channel}: ${r.status}`),
  };
}
