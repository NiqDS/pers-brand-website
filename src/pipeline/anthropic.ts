import Anthropic from '@anthropic-ai/sdk';
import { config, hasAnthropicKey } from '../config.js';

/** Thrown when the pipeline is invoked without an API key configured. */
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'ANTHROPIC_API_KEY is not set. Add it to your .env to enable content generation.\n' +
        'The rest of the app (site, subscriptions) runs fine without it.',
    );
    this.name = 'MissingApiKeyError';
  }
}

/** Thrown when Claude declines the request (safety refusal). */
export class RefusalError extends Error {
  constructor(public readonly category: string | null) {
    super(`The model declined this request${category ? ` (category: ${category})` : ''}.`);
    this.name = 'RefusalError';
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!hasAnthropicKey()) throw new MissingApiKeyError();
  if (!client) client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Send a single prompt to Claude and return the text response.
 *
 * Mirrors the content-pipeline artifact's `askClaude(prompt)` helper, but runs
 * server-side with the official SDK: the configured model, adaptive thinking,
 * and streaming (so long articles never hit an HTTP timeout). Refusals are
 * surfaced as a typed error rather than crashing the caller.
 */
export async function askClaude(prompt: string, maxTokens = 16000): Promise<string> {
  const anthropic = getClient();

  // The SDK's typed params lag newer fields (adaptive thinking); pass through
  // as a loosely-typed request body and let the API validate.
  const params = {
    model: config.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  } as unknown as Anthropic.MessageCreateParamsStreaming;

  const stream = anthropic.messages.stream(params);
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    const category =
      (message as { stop_details?: { category?: string | null } }).stop_details?.category ?? null;
    throw new RefusalError(category);
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  if (!text) {
    throw new Error(`Empty response from the model (stop_reason: ${message.stop_reason}).`);
  }
  return text;
}
