import { config } from '../config.js';
import {
  confirmedSubscribers,
  getDraft,
  getPostById,
  hasSuccessfulDelivery,
  recordDelivery,
} from '../db/queries.js';
import type { Arc } from '../db/types.js';
import { excerpt } from '../web/markdown.js';
import { buildRoundupEmail, getTransport } from '../email/index.js';

export interface DeliveryReport {
  status: 'sent' | 'skipped' | 'failed';
  recipients: number;
  detail: string;
}

function postUrl(slug: string): string {
  return `${config.BASE_URL}/p/${slug}`;
}

/**
 * The roundup body: the Friday LinkedIn draft (3 findings + CTA) is the natural
 * source. We swap its "[SUBSTACK LINK]" placeholder for the on-site post URL.
 * If there's no such draft, fall back to an excerpt of the article.
 */
function roundupMarkdown(arc: Arc, articleMd: string, url: string): string {
  const friLi = getDraft(arc.id, 'fri-li')?.body_md;
  if (friLi) {
    return friLi.replace(/\[SUBSTACK LINK\]/gi, url);
  }
  return `${excerpt(articleMd, 500)}\n\nRead the full analysis below.`;
}

/**
 * Send the weekly arc roundup to every confirmed subscriber, exactly once.
 *
 * Idempotent: if a successful 'email' delivery already exists for this post,
 * the send is skipped. One `deliveries` row is recorded per invocation.
 */
export async function deliverArcRoundup(arc: Arc): Promise<DeliveryReport> {
  if (!arc.post_id) {
    return { status: 'failed', recipients: 0, detail: 'arc has no published post' };
  }
  const post = getPostById(arc.post_id);
  if (!post) {
    return { status: 'failed', recipients: 0, detail: 'post not found' };
  }

  // Never double-send.
  if (hasSuccessfulDelivery(post.id, 'email')) {
    return { status: 'skipped', recipients: 0, detail: 'already delivered' };
  }

  const subs = confirmedSubscribers();
  if (subs.length === 0) {
    recordDelivery(post.id, 'email', 'skipped', 'no confirmed subscribers');
    return { status: 'skipped', recipients: 0, detail: 'no confirmed subscribers' };
  }

  const url = postUrl(post.slug);
  const md = roundupMarkdown(arc, post.body_md, url);
  const subject = `${config.SITE_NAME} — Week ${arc.week_number}: ${arc.topic}`;
  const transport = getTransport();

  let sent = 0;
  const failures: string[] = [];
  for (const sub of subs) {
    try {
      await transport.send(
        buildRoundupEmail({ to: sub.email, token: sub.confirm_token, subject, roundupMd: md, postUrl: url }),
      );
      sent += 1;
    } catch (err) {
      failures.push(`${sub.email}: ${(err as Error).message}`);
    }
  }

  if (failures.length === 0) {
    recordDelivery(post.id, 'email', 'sent', `${sent} recipient(s)`);
    return { status: 'sent', recipients: sent, detail: `${sent} recipient(s)` };
  }

  // Partial/total failure: record as failed (no successful row) so a later run
  // retries rather than treating this as complete.
  const detail = `${sent} sent, ${failures.length} failed: ${failures.slice(0, 3).join('; ')}`;
  recordDelivery(post.id, 'email', 'failed', detail);
  return { status: 'failed', recipients: sent, detail };
}
