import { config } from '../config.js';

/**
 * The editorial context for one weekly arc — the inputs the content-pipeline
 * artifact collected in its sidebar (week, topic, thesis, source notes, tease).
 */
export interface ArcContext {
  week: number | string;
  topic: string;
  thesis: string;
  sources: string;
  tease: string;
}

/** Snippets of already-generated movements, used for cross-movement continuity. */
export interface Priors {
  tue?: string;
  thu?: string;
}

const AUDIENCE = () =>
  `${config.SITE_NAME}, a newsletter on ${config.SITE_TAGLINE} for a senior finance audience`;

const sourcesOr = (c: ArcContext, fallback: string) =>
  c.sources.trim() ? c.sources : `${c.topic} — ${fallback}`;

// ── Movement I — Tuesday LinkedIn (The Question, ~400w) ──────────────────────
export function pTue(c: ArcContext): string {
  return `You are writing for ${AUDIENCE()}.

TASK: Write Movement I — "The Question" — Tuesday LinkedIn post, Week ${c.week}.

TOPIC: ${c.topic}
ARC THESIS (week's conclusion — do NOT reveal yet): ${c.thesis}
SOURCE NOTES / KEY DATA:
${sourcesOr(c, 'use current knowledge of this topic')}

REQUIREMENTS:
- ~400 words (380–430)
- NO headers, bullets, emojis — flowing paragraphs only
- Tone: analytical, precise, first-person. Do NOT reveal the arc's conclusion.

WRITING PATTERN — follow exactly:
1. LEAD: Open sentence = a hard, specific number or concrete event (NOT context, NOT "In recent years…"). Second sentence = why this changes the reader's mental model ("This isn't X — it's really Y"). Only then widen to context.
2. REFRAME: Somewhere in the body, include a contrarian reframe that inverts the conventional assumption about the topic. Give readers a reason to share ("here's what everyone's getting wrong").
3. NAMED ENTITIES: Name specific companies, institutions, people — never just "the sector" or "Gulf states." Named protagonists outperform abstractions.
4. STAKES: Signal urgency with present-tense, consequence-forward language ("the war is testing," "a rough period could follow") — no hype adjectives without a number.
5. CLOSE: Pose one sharp, falsifiable open question — something readers can predict and debate. Then tease Thursday evidence and Friday full analysis.
6. FINAL CTA: "I'm unpacking this Thursday — follow to catch it." or similar.

Output ONLY the post text.`;
}

// ── Movement II — Thursday LinkedIn (The Evidence, ~850w) ─────────────────────
export function pThu(c: ArcContext, priors: Priors = {}): string {
  const tueSnip = priors.tue
    ? `\n\nTUESDAY POST (reference opening briefly):\n${priors.tue.slice(0, 500)}…`
    : '';
  return `You are writing for ${AUDIENCE()}.

TASK: Write Movement II — "The Evidence" — Thursday LinkedIn post, Week ${c.week}.

TOPIC: ${c.topic}
ARC THESIS: ${c.thesis}
SOURCE NOTES / KEY DATA:
${sourcesOr(c, 'use current knowledge')}
${tueSnip}

REQUIREMENTS:
- ~850 words (820–900)
- Opens 2–3 sentences referencing Tuesday's question ("On Tuesday I asked…")
- Body: THREE bold-headed findings (**Finding N: [Declarative Title with a number or named entity]** format)
- After findings: **The counterargument worth taking seriously** (100–120 words)
- Close: 1–2 sentences with a forward-looking "what to watch" signal, then tease Friday.
- Tone: data-grounded, analytically honest, first-person.
- NO emojis. Bold only for finding headers.

WRITING PATTERN — apply to every finding:
STRUCTURE per finding: (1) hard number or concrete event → (2) reframe / why this changes the model → (3) named player(s) and their position → (4) at least one attributed expert quote or named analyst view (e.g., "Goldman Sachs economists argue…", "Jack Selby told CNBC…") → (5) implication for the reader.
NUMERIC DENSITY: Every finding must include specific figures — investment totals, %, market moves, headcounts. Never vague ("significant investment") when a number is available.
COUNTER-VIEW: Name the skeptic explicitly — a named institution, analyst, or report — and state their strongest objection fairly. One-sided pieces earn less debate and less trust.
WHAT TO WATCH: End with one falsifiable forward signal — a specific event, data point, or decision that will confirm or disprove the thesis in the next 6–12 months.

Output ONLY the post text.`;
}

// ── Movement III — Friday LinkedIn (Preview + Results, ~500w) ─────────────────
export function pFriLi(c: ArcContext, priors: Priors = {}): string {
  const tue = priors.tue ? `\nTUESDAY (brief): ${priors.tue.slice(0, 350)}` : '';
  const thu = priors.thu ? `\nTHURSDAY (brief): ${priors.thu.slice(0, 350)}` : '';
  return `You are writing for ${AUDIENCE()}.

TASK: Write Movement III — "Preview + Results" — Friday LinkedIn post, Week ${c.week}.

TOPIC: ${c.topic}
ARC THESIS: ${c.thesis}
SOURCE NOTES:
${sourcesOr(c, 'use current knowledge')}${tue}${thu}
NEXT WEEK TEASE: ${c.tease || '(not set)'}

REQUIREMENTS:
- ~500 words (480–540)
- Opens: "This week I asked [question]. On Tuesday I opened with [fact]. On Thursday I showed you [what]. Today I'm closing the arc."
- Body: THREE bold-headed findings — **Finding N: [Declarative Title that includes a specific number or named entity]** + 2–3 sentences. Be conclusive — this closes the arc.
- Close: "The full analysis — [description] — is in this week's Substack: [SUBSTACK LINK]"
- Last line: Tease next week.
- NO emojis. Bold only for finding headers.

WRITING PATTERN:
FINDING HEADERS: Each must contain either a hard number or a named entity. Weak: "Finding 1: The chip deal matters." Strong: "Finding 1: 35,000 Blackwell chips — and the loyalty test attached."
LOCALIZE: Give the reader a direct stake — investor, finance professional, or policymaker — in the finding's implication. This is what makes pieces travel beyond a general tech audience.
CLOSING SIGNAL: End with one forward-looking, falsifiable signal the reader can watch for. Commenters and sharers engage most with something they can predict or dispute.

Output ONLY the post text.`;
}

// ── Movement III — Friday Substack (Full Article, ~2100w) ─────────────────────
export function pFriSub(c: ArcContext): string {
  return `You are writing a long-form Substack article for ${AUDIENCE()}. Style: serious analytical journalism — precise, sourced, intellectually honest.

TASK: Write Movement III — Friday Substack full article, Week ${c.week}.

TOPIC: ${c.topic}
ARC THESIS: ${c.thesis}
SOURCE NOTES / KEY DATA:
${sourcesOr(c, 'use current knowledge of this topic and cite real sources')}
NEXT WEEK TEASE: ${c.tease || '(not set)'}

REQUIRED STRUCTURE (use bold section headers exactly as shown):

**Lede** — 2–3 striking sentences naming the central tension. Open on the concrete event or number — never "In recent years" or "This week." Second sentence: why this changes the reader's mental model.

**Why this matters now** — Context and 2026 stakes. (~150 words)

**The data** — 3–4 paragraphs, each grounded in a specific source and statistic. Name every source explicitly. Each paragraph: hard number → reframe → named player(s) → attributed analyst/expert view. (~500 words)

**The mechanism** — How and why does this dynamic work? Underlying structure, not just symptoms. (~250 words)

**The counterargument** — Steelman the opposing view. Name the skeptic explicitly (institution, analyst, or report). What do critics get right, and what would have to be true for them to be right? (~200 words)

**What this means for you** — Practical implications by named audience segment (investors / finance professionals in [specific market] / policymakers in middle-power countries). Localize: give each segment a direct personal or professional stake. (~250 words)

**The design choice** — Restate arc thesis as a structural claim: this is the result of identifiable choices, not inevitable outcomes. (~150 words)

**Annotated Sources** — Numbered list. Bold source name, URL/publication, what it contributes.

REQUIREMENTS:
- ~2100 words total
- First-person, no emojis
- ONE clear thesis carried start to finish — do not try to cover all angles
- Every factual claim traceable to source notes
- If the topic involves jobs or social impact: anchor on one named or composite individual before the macro data — the individual-then-aggregate move widens the audience
- Do NOT treat "Asia" or "Middle East" as monoliths — name the specific country and distinguish between Saudi ≠ UAE ≠ Qatar; India ≠ China ≠ Singapore
- Final "What to watch" signal: make it falsifiable — one specific event, data release, or decision in the next 6–12 months that will confirm or disprove the thesis
- Close with: "Next week: ${c.tease || '[next topic]'}"

Output ONLY the article text.`;
}

// ── Weekly Editorial Brief ────────────────────────────────────────────────────
export function pBrief(c: ArcContext): string {
  return `Create a structured editorial brief for the ${config.SITE_NAME} content pipeline.

WEEK: ${c.week}
TOPIC: ${c.topic}
ARC THESIS: ${c.thesis}
SOURCE NOTES: ${c.sources || '(none provided)'}

Write a concise editorial brief with these sections:

1. ARC SUMMARY — 2–3 sentences capturing the full three-movement arc

2. ENGAGEMENT TIER — Classify this topic against the Asia/ME engagement tier framework:
   Tier 1 (highest — markets + geopolitics + identity fused): China-US race, Gulf "protection money"
   Tier 2 (high — personal stakes): India IT job losses, conflict testing Gulf AI ambitions
   Tier 3 (steady, authoritative): chip profits / "real money in Asia", sovereign-AI strategies
   Tier 4 (bookmarked, not debated): GDP forecasts, governance trackers
   State the tier, the engagement mechanism, and the recommended structural move (Tier 1–2: lead with the conflict/race/personal stake; Tier 3–4: borrow Tier-1 structural moves anyway).

3. HOOK OPTIONS — 3 alternative Tuesday opening sentences using the proven patterns:
   a) Hard specific number + superlative (e.g., "$588.8B wiped in a day")
   b) Contrarian reframe that inverts the conventional assumption
   c) Named protagonist + stakes (specific company/person + consequence)

4. KEY DATA POINTS — 6–8 bullet points of the most important statistics to deploy across the week. Flag which day each stat is best deployed on (Tue / Thu / Fri).

5. PUBLICATION SCHEDULE — Day | Format | Target Length | Key Focus | Lead Hook (table)

6. SOURCE REQUIREMENTS — Tier 1 (IMF, BIS, FSB, Fed, ECB, CCAF, WEF) and Tier 2 (FT, Economist, Chatham House, Oliver Wyman, Deutsche Bank) sources needed; what to verify from each; flag any claims in source notes that need re-verification before publication.

7. DRAFT CHECKLIST — Run the following against all four drafts before publishing:
   - Headline/opening contains a specific number, named entity, or genuine reframe
   - Lead opens on event/number, NOT background
   - One clear thesis carried start to finish
   - At least one attributed, named-expert quote in Thu + Substack
   - Numeric density: investment totals, %s, market moves, headcounts throughout
   - Explicit counter-view with named skeptic
   - National/local stake for target audience
   - Forward-looking "what to watch" close that is falsifiable
   - No hype adjectives without a number ("massive," "game-changing" alone)
   - No "Middle East" or "Asia" treated as monolith — named countries only
   - No one-sided pieces — counter-view is mandatory

8. EDITORIAL NOTES — 3–5 notes on tone, framing, potential sensitivities, audience considerations for this specific topic.

Keep it tight and actionable.`;
}

// ── Claim Validator ───────────────────────────────────────────────────────────
export function pValidate(sources: string, draft: string): string {
  return `You are a fact-checker for a finance and AI newsletter.

SOURCE NOTES (what was researched):
${sources || '(no source notes — flag everything as unverified)'}

DRAFT TEXT:
${draft}

Extract every factual claim. For each, assess:
- VERIFIED: directly supported by source notes
- PARTIAL: partially supported with caveats
- UNVERIFIED: not in source notes
- QUALITATIVE: opinion or non-falsifiable framing

Return JSON only:
{"summary":"1–2 sentence overall assessment","claims":[{"claim":"text","verdict":"verified|partial|unverified|qualitative","note":"explanation"}]}`;
}
