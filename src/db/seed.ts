import { getDb } from './index.js';
import { insertPost } from './queries.js';

/**
 * Seed a few sample posts the first time the app runs, so the site isn't empty
 * in development. No-op once any post exists.
 */
export function seedIfEmpty(): void {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM posts').get() as { n: number };
  if (row.n > 0) return;

  insertPost({
    kind: 'digest',
    title: 'Week 1 — Who actually controls AI in finance?',
    theme: 'Digital Economics — AI, Finance & Financial Literacy',
    status: 'published',
    body_md: `**The lede.** A handful of firms now supply the compute, the models, and the market data that price the world's assets. That is not a product story — it is a control story.

**Why this matters now.** As banks wire large language models into research, compliance, and trading, the question of *who owns the stack* becomes a question of who sets the terms of finance itself.

**The three findings**

- **Finding 1: Concentration is the feature, not the bug.** The economics of frontier models reward scale, and scale rewards incumbents.
- **Finding 2: The data moat is quieter than the compute moat.** Proprietary market and transaction data may matter more than raw GPUs.
- **Finding 3: Regulators are pricing in model risk.** Supervisors are starting to treat model dependence as systemic.

**What to watch.** Whether a mid-size bank ships a production trading model built on an open-weight stack in the next 6–12 months.

*Next week: the sovereign-AI money trail.*`,
  });

  insertPost({
    kind: 'article',
    title: 'A field guide to reading a central bank',
    status: 'published',
    body_md: `Central-bank communication is a genre with its own grammar. This is a short guide to reading it without over-reading it.

## Start with the verbs

"We will" is a commitment. "We stand ready to" is an option. The distance between them is the whole story.

## Watch the risk paragraph

The paragraph on risks to the outlook tells you where the committee is actually looking — often more than the headline decision does.`,
  });

  insertPost({
    kind: 'note',
    title: 'A note on "AI productivity"',
    status: 'published',
    body_md: `Productivity statistics lag adoption by years. The absence of an AI bump in this quarter's numbers tells you almost nothing about whether the tools are working — only that measurement is slow.`,
  });
}
