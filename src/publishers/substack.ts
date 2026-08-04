import { config } from '../config.js';
import type { Post } from '../db/types.js';
import { getTransport } from '../email/index.js';
import type { Publisher, PublishResult } from './index.js';

/**
 * Substack has no official public write API. Two realistic paths:
 *
 *  1. RSS import (default): the site exposes /rss.xml; a Substack RSS-import
 *     publication pulls new posts. Nothing to push here — the post is already
 *     in the feed — so we log 'skipped: served via RSS'.
 *  2. Email-to-publish (optional): if SUBSTACK_POST_EMAIL is set, email the
 *     post to Substack's post-by-email address.
 */
export const substackPublisher: Publisher = {
  channel: 'substack',
  async publish(post: Post): Promise<PublishResult> {
    if (!config.SUBSTACK_POST_EMAIL) {
      return {
        channel: 'substack',
        status: 'skipped',
        detail: 'served via RSS import (/rss.xml)',
      };
    }
    await getTransport().send({
      to: config.SUBSTACK_POST_EMAIL,
      subject: post.title,
      html: `<p>${post.title}</p>`,
      text: post.body_md,
    });
    return {
      channel: 'substack',
      status: 'sent',
      detail: `emailed to ${config.SUBSTACK_POST_EMAIL}`,
    };
  },
};
