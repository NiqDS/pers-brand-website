import { z } from 'zod';

/**
 * Central configuration. All environment access happens here and is validated
 * with zod so missing/invalid required vars fail fast with a clear message.
 */
const boolFromEnv = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1' || v?.toLowerCase() === 'yes');

const schema = z.object({
  // core
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_PATH: z.string().min(1).default('./data/app.db'),
  ADMIN_TOKEN: z.string().min(1).default('change-me-long-random'),
  NODE_ENV: z.string().default('development'),
  SITE_NAME: z.string().min(1).default('Digital Economics'),
  SITE_TAGLINE: z.string().min(1).default('AI, Finance & Financial Literacy'),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-5'),
  DIGEST_THEME: z.string().min(1).default('Digital Economics — AI, Finance & Financial Literacy'),

  // schedule
  SCHEDULER_ENABLED: boolFromEnv,
  DIGEST_CRON: z.string().min(1).default('0 7 * * 5'),
  DIGEST_TZ: z.string().min(1).default('Europe/London'),

  // email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(1).default('Digital Economics <news@example.com>'),

  // substack (optional)
  SUBSTACK_POST_EMAIL: z.string().optional(),

  // linkedin (optional)
  LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  LINKEDIN_REFRESH_TOKEN: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_AUTHOR_URN: z.string().optional(),
}).superRefine((cfg, ctx) => {
  if (
    cfg.NODE_ENV === 'production' &&
    (cfg.ADMIN_TOKEN === 'change-me-long-random' || cfg.ADMIN_TOKEN.length < 32)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['ADMIN_TOKEN'],
      message: 'must be a unique secret of at least 32 characters in production',
    });
  }
});

export type Config = z.infer<typeof schema>;

function loadConfig(): Config {
  const parsed = parseConfig(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // Fail fast with a clear, friendly message — not a stack trace.
    console.error(`\nInvalid configuration. Fix these environment variables:\n${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export function parseConfig(env: NodeJS.ProcessEnv) {
  return schema.safeParse(env);
}

export const config = loadConfig();

/** True when a real Anthropic key is configured (digest generation available). */
export const hasAnthropicKey = (): boolean =>
  typeof config.ANTHROPIC_API_KEY === 'string' && config.ANTHROPIC_API_KEY.length > 0;
