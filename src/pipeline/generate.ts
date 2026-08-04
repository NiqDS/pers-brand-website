import type { Arc, Draft, Movement, Post } from '../db/types.js';
import {
  getArc,
  getDraft,
  insertPost,
  linkArcToPost,
  publishArc,
  slugify,
  upsertDraft,
} from '../db/queries.js';
import { askClaude } from './anthropic.js';
import {
  pBrief,
  pFriLi,
  pFriSub,
  pThu,
  pTue,
  pValidate,
  type ArcContext,
  type Priors,
} from './prompts.js';

export const MOVEMENT_ORDER: Movement[] = ['tue', 'thu', 'fri-li', 'fri-sub', 'brief'];

const MAX_TOKENS: Record<Movement, number> = {
  tue: 4000,
  thu: 8000,
  'fri-li': 4000,
  'fri-sub': 16000,
  brief: 8000,
};

export function arcContext(arc: Arc): ArcContext {
  return {
    week: arc.week_number,
    topic: arc.topic,
    thesis: arc.thesis,
    sources: arc.source_notes,
    tease: arc.tease,
  };
}

function buildPrompt(movement: Movement, ctx: ArcContext, priors: Priors): string {
  switch (movement) {
    case 'tue':
      return pTue(ctx);
    case 'thu':
      return pThu(ctx, priors);
    case 'fri-li':
      return pFriLi(ctx, priors);
    case 'fri-sub':
      return pFriSub(ctx);
    case 'brief':
      return pBrief(ctx);
  }
}

/** Read the stored tue/thu drafts for continuity when generating later movements. */
function priorsFor(arcId: number): Priors {
  return {
    tue: getDraft(arcId, 'tue')?.body_md,
    thu: getDraft(arcId, 'thu')?.body_md,
  };
}

/** Generate one movement's text from context (no DB read/write). Used by dry-run. */
export async function generateText(
  ctx: ArcContext,
  movement: Movement,
  priors: Priors = {},
): Promise<string> {
  return askClaude(buildPrompt(movement, ctx, priors), MAX_TOKENS[movement]);
}

/** Generate one movement for an arc and save it as a draft. */
export async function generateMovement(arcId: number, movement: Movement): Promise<Draft> {
  const arc = getArc(arcId);
  if (!arc) throw new Error(`Arc ${arcId} not found`);
  const prompt = buildPrompt(movement, arcContext(arc), priorsFor(arcId));
  const body = await askClaude(prompt, MAX_TOKENS[movement]);
  return upsertDraft(arcId, movement, body);
}

/**
 * Generate the full weekly arc — the four movements in continuity order, then
 * the editorial brief. Returns the drafts keyed by movement.
 */
export async function generateArc(arcId: number): Promise<Record<Movement, Draft>> {
  const out = {} as Record<Movement, Draft>;
  for (const movement of MOVEMENT_ORDER) {
    out[movement] = await generateMovement(arcId, movement);
  }
  return out;
}

// ── Validation ───────────────────────────────────────────────────────────────

export type Verdict = 'verified' | 'partial' | 'unverified' | 'qualitative';

export interface ClaimResult {
  claim: string;
  verdict: Verdict;
  note: string;
}

export interface ValidationResult {
  summary: string;
  claims: ClaimResult[];
}

/** Fact-check a draft's claims against the arc's source notes. */
export async function validateDraft(sources: string, draft: string): Promise<ValidationResult> {
  const raw = await askClaude(pValidate(sources, draft), 8000);
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as ValidationResult;
  return {
    summary: parsed.summary ?? '',
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
  };
}

// ── Publishing ────────────────────────────────────────────────────────────────

/**
 * Publish the arc's Friday Substack article as a post (kind='digest'), link it
 * back to the arc, and mark the arc published. The digest post is the flagship
 * weekly piece and the source for the RSS feed / Substack import.
 */
export function publishArcArticle(arc: Arc, articleMd: string): Post {
  const title = `Week ${arc.week_number} — ${arc.topic}`;
  const post = insertPost({
    slug: slugify(title),
    kind: 'digest',
    title,
    body_md: articleMd,
    theme: arc.topic,
    status: 'published',
  });
  linkArcToPost(arc.id, post.id);
  publishArc(arc.id);
  return post;
}
