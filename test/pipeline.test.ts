import { afterAll, describe, expect, it, vi } from 'vitest';

// Mock the Anthropic wrapper so no real API calls happen in the suite.
vi.mock('../src/pipeline/anthropic.js', () => ({
  askClaude: vi.fn(async (prompt: string) => {
    if (prompt.includes('Return JSON only')) {
      return '```json\n{"summary":"Looks solid.","claims":[{"claim":"$588.8B wiped","verdict":"verified","note":"in notes"}]}\n```';
    }
    return `Generated draft for: ${prompt.slice(0, 30)} ...\n\nWith several words of body content here.`;
  }),
  MissingApiKeyError: class extends Error {},
  RefusalError: class extends Error {},
}));

const { closeDb } = await import('../src/db/index.js');
const { insertArc, getArc, getDeliveries } = await import('../src/db/queries.js');
const { generateArc, validateDraft, publishArcArticle } = await import(
  '../src/pipeline/generate.js'
);

afterAll(() => closeDb());

function makeArc() {
  return insertArc({
    week_number: 4,
    topic: 'Who controls AI in finance?',
    thesis: 'Compute concentration is a control story.',
    source_notes: '$588.8B wiped in a day; Nvidia; Goldman Sachs.',
    tease: 'CBDC pilots in 130 countries',
  });
}

describe('pipeline', () => {
  it('generates all five movements as drafts', async () => {
    const arc = makeArc();
    const drafts = await generateArc(arc.id);
    for (const m of ['tue', 'thu', 'fri-li', 'fri-sub', 'brief'] as const) {
      expect(drafts[m].movement).toBe(m);
      expect(drafts[m].word_count).toBeGreaterThan(0);
    }
  });

  it('parses the claim validator JSON (fenced) into a structured result', async () => {
    const result = await validateDraft('some notes', 'a draft with claims');
    expect(result.summary).toBe('Looks solid.');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]!.verdict).toBe('verified');
  });

  it('publishes the Friday article as a published digest post linked to the arc', () => {
    const arc = makeArc();
    const post = publishArcArticle(arc, '**Lede** — Something concrete happened.');
    expect(post.kind).toBe('digest');
    expect(post.status).toBe('published');
    expect(post.title).toContain('Week 4');
    const refreshed = getArc(arc.id);
    expect(refreshed?.post_id).toBe(post.id);
    expect(refreshed?.status).toBe('published');
    // No deliveries yet — publishing the post doesn't send anything.
    expect(getDeliveries(post.id)).toHaveLength(0);
  });
});
