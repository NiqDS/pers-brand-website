import { config } from '../config.js';
import type { Post } from '../db/types.js';
import { excerpt } from '../web/markdown.js';
import type { Publisher, PublishResult } from './index.js';

const LINKEDIN_VERSION = '202401';
const POSTS_URL = 'https://api.linkedin.com/rest/posts';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

// Refreshed access token held in memory for the life of the process. LinkedIn
// tokens outlive a single run, so this is a best-effort in-process refresh.
let liveToken: string | null = null;

function teaser(post: Post): string {
  const url = `${config.BASE_URL}/p/${post.slug}`;
  return `${post.title}\n\n${excerpt(post.body_md, 240)}\n\nRead the full analysis: ${url}`;
}

/** Exchange the refresh token for a new access token. Returns null on failure. */
async function refreshAccessToken(): Promise<string | null> {
  if (!config.LINKEDIN_REFRESH_TOKEN || !config.LINKEDIN_CLIENT_ID || !config.LINKEDIN_CLIENT_SECRET) {
    return null;
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.LINKEDIN_REFRESH_TOKEN,
    client_id: config.LINKEDIN_CLIENT_ID,
    client_secret: config.LINKEDIN_CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function postToLinkedIn(token: string, post: Post): Promise<Response> {
  return fetch(POSTS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: config.LINKEDIN_AUTHOR_URN,
      commentary: teaser(post),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
}

/**
 * Post a short teaser + link to LinkedIn via the official Posts API. Degrades
 * gracefully: with no credentials it logs 'failed: no LinkedIn credentials'
 * rather than throwing, so a scheduled run still completes.
 *
 * Note: some post scopes require LinkedIn's app review before they work in
 * production (see README). This is fully testable once a token is provided.
 */
export const linkedinPublisher: Publisher = {
  channel: 'linkedin',
  async publish(post: Post): Promise<PublishResult> {
    const token = liveToken ?? config.LINKEDIN_ACCESS_TOKEN;
    if (!token || !config.LINKEDIN_AUTHOR_URN) {
      return { channel: 'linkedin', status: 'failed', detail: 'no LinkedIn credentials' };
    }

    let res = await postToLinkedIn(token, post);

    // On an expired token, try one refresh + retry.
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        liveToken = refreshed;
        res = await postToLinkedIn(refreshed, post);
      }
    }

    if (res.status >= 200 && res.status < 300) {
      const id = res.headers.get('x-restli-id') ?? '';
      return { channel: 'linkedin', status: 'sent', detail: id ? `post ${id}` : 'posted' };
    }
    const detail = `LinkedIn API ${res.status}: ${(await res.text()).slice(0, 200)}`;
    return { channel: 'linkedin', status: 'failed', detail };
  },
};

/** Test hook: clear the in-memory refreshed token. */
export function resetLinkedInToken(): void {
  liveToken = null;
}
