import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { config, hasAnthropicKey } from '../config.js';
import { getDb } from '../db/index.js';
import { getDraft, getLatestArc, insertArc } from '../db/queries.js';
import type { Movement } from '../db/types.js';
import { MissingApiKeyError, RefusalError } from '../pipeline/anthropic.js';
import {
  MOVEMENT_ORDER,
  generateArc,
  generateText,
  publishArcArticle,
} from '../pipeline/generate.js';
import type { ArcContext, Priors } from '../pipeline/prompts.js';

const MOVEMENT_TITLES: Record<Movement, string> = {
  tue: 'Movement I — Tuesday LinkedIn (The Question)',
  thu: 'Movement II — Thursday LinkedIn (The Evidence)',
  'fri-li': 'Movement III — Friday LinkedIn (Preview + Results)',
  'fri-sub': 'Movement III — Friday Substack (Full Article)',
  brief: 'Weekly Editorial Brief',
};

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    week: { type: 'string' },
    topic: { type: 'string' },
    thesis: { type: 'string' },
    sources: { type: 'string' },
    'sources-file': { type: 'string' },
    tease: { type: 'string' },
    movement: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-publish': { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

function buildContext(): { ctx: ArcContext; week: number } {
  const fromFile = values.input
    ? (JSON.parse(readFileSync(values.input, 'utf8')) as Partial<ArcContext>)
    : {};
  const sources = values['sources-file']
    ? readFileSync(values['sources-file'], 'utf8')
    : (values.sources ?? (fromFile.sources as string | undefined) ?? '');

  const nextWeek = (getLatestArc()?.week_number ?? 0) + 1;
  const week = Number(values.week ?? fromFile.week ?? nextWeek);

  const ctx: ArcContext = {
    week,
    topic: values.topic ?? (fromFile.topic as string | undefined) ?? config.DIGEST_THEME,
    thesis: values.thesis ?? (fromFile.thesis as string | undefined) ?? '',
    sources,
    tease: values.tease ?? (fromFile.tease as string | undefined) ?? '',
  };
  return { ctx, week };
}

async function run(): Promise<void> {
  if (!hasAnthropicKey()) {
    fail(new MissingApiKeyError().message);
  }

  const { ctx, week } = buildContext();
  const only = values.movement as Movement | undefined;
  if (only && !MOVEMENT_ORDER.includes(only)) {
    fail(`Unknown --movement "${only}". Use one of: ${MOVEMENT_ORDER.join(', ')}`);
  }
  const movements = only ? [only] : MOVEMENT_ORDER;

  console.log(`\n${config.SITE_NAME} — Week ${week}: ${ctx.topic}`);
  if (ctx.thesis) console.log(`Thesis: ${ctx.thesis}`);
  console.log(values['dry-run'] ? '(dry run — nothing will be saved)\n' : '');

  if (values['dry-run']) {
    const priors: Priors = {};
    for (const m of movements) {
      process.stderr.write(`… generating ${m}\n`);
      const text = await generateText(ctx, m, priors);
      if (m === 'tue') priors.tue = text;
      if (m === 'thu') priors.thu = text;
      console.log(`\n\n===== ${MOVEMENT_TITLES[m]} =====\n\n${text}\n`);
    }
    return;
  }

  // Persisted run: create the arc, generate + save drafts, publish the article.
  getDb();
  const arc = insertArc({
    week_number: week,
    topic: ctx.topic,
    thesis: ctx.thesis,
    source_notes: ctx.sources,
    tease: ctx.tease,
  });

  if (only) {
    process.stderr.write(`… generating ${only}\n`);
    const { generateMovement } = await import('../pipeline/generate.js');
    const draft = await generateMovement(arc.id, only);
    console.log(`\nSaved draft ${only} (${draft.word_count} words) for arc #${arc.id}.`);
    return;
  }

  for (const m of MOVEMENT_ORDER) process.stderr.write(`… generating ${m}\n`);
  const drafts = await generateArc(arc.id);
  console.log('\nGenerated drafts:');
  for (const m of MOVEMENT_ORDER) console.log(`  ${m.padEnd(8)} ${drafts[m].word_count} words`);

  if (!values['no-publish']) {
    const article = getDraft(arc.id, 'fri-sub');
    if (article) {
      const post = publishArcArticle(arc, article.body_md);
      console.log(`\nPublished the Friday article as a digest post:`);
      console.log(`  ${config.BASE_URL}/p/${post.slug}`);
    }
  }
  console.log('');
}

run().catch((err: unknown) => {
  if (err instanceof MissingApiKeyError || err instanceof RefusalError) {
    fail(err.message);
  }
  fail(err instanceof Error ? err.message : String(err));
});
