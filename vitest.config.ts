import { defineConfig } from 'vitest/config';

export default defineConfig({
  // node:sqlite is a Node 22 builtin newer than Vite's bundled builtins list.
  // Intercept resolution and mark it external so Vite doesn't try to bundle "sqlite".
  plugins: [
    {
      name: 'externalize-node-sqlite',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'node:sqlite' || id === 'sqlite') {
          return { id: 'node:sqlite', external: true };
        }
        return null;
      },
    },
  ],
  test: {
    // Each test file runs isolated; use an in-memory DB so tests never touch disk.
    env: {
      DATABASE_PATH: ':memory:',
      ADMIN_TOKEN: 'test-token',
      BASE_URL: 'http://localhost:3000',
    },
  },
});
