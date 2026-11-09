import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';

describe('configuration security', () => {
  it('rejects the development admin token in production', () => {
    const result = parseConfig({ NODE_ENV: 'production' });
    expect(result.success).toBe(false);
  });

  it('accepts a unique production admin token of sufficient length', () => {
    const result = parseConfig({
      NODE_ENV: 'production',
      ADMIN_TOKEN: 'a-unique-random-token-with-more-than-32-characters',
    });
    expect(result.success).toBe(true);
  });
});
