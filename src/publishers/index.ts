import type { Post } from '../db/types.js';
import { recordDelivery } from '../db/queries.js';
import type { DeliveryChannel } from '../db/types.js';

export interface PublishResult {
  channel: DeliveryChannel;
  status: 'sent' | 'failed' | 'skipped';
  detail: string;
}

/**
 * A publisher pushes a post to one external network. Each is isolated: a
 * failure is logged to `deliveries` and never blocks the others or the email.
 */
export interface Publisher {
  readonly channel: DeliveryChannel;
  publish(post: Post): Promise<PublishResult>;
}

const publishers: Publisher[] = [];

export function registerPublisher(p: Publisher): void {
  publishers.push(p);
}

/** Register the built-in publishers (Substack, LinkedIn). Called on server boot;
 *  left uncalled in tests so external channels are opt-in per test. */
export async function registerDefaultPublishers(): Promise<void> {
  const [{ substackPublisher }, { linkedinPublisher }] = await Promise.all([
    import('./substack.js'),
    import('./linkedin.js'),
  ]);
  registerPublisher(substackPublisher);
  registerPublisher(linkedinPublisher);
}

/**
 * Run every registered publisher for a post, recording one delivery row each.
 * Never throws — a publisher error becomes a 'failed' result.
 */
export async function publishPost(post: Post): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const p of publishers) {
    let result: PublishResult;
    try {
      result = await p.publish(post);
    } catch (err) {
      result = { channel: p.channel, status: 'failed', detail: (err as Error).message };
    }
    recordDelivery(post.id, result.channel, result.status, result.detail);
    results.push(result);
  }
  return results;
}
