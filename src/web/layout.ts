import { html, raw } from 'hono/html';
import { config } from '../config.js';

export interface PageOptions {
  title?: string;
  description?: string;
}

/**
 * Full HTML document shell. `content` is trusted, already-rendered HTML
 * (page fragments / markdown output) and is injected with raw().
 */
export function page(content: string, opts: PageOptions = {}): string {
  const title = opts.title ? `${opts.title} · ${config.SITE_NAME}` : config.SITE_NAME;
  const description = opts.description ?? config.SITE_TAGLINE;
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <link rel="alternate" type="application/rss+xml" title="${config.SITE_NAME}" href="/rss.xml" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="wrap">
          <header class="site-header">
            <h1><a href="/">${config.SITE_NAME}</a></h1>
            <p class="tagline">${config.SITE_TAGLINE}</p>
            <nav class="site-nav">
              <a href="/">Home</a>
              <a href="/notes">Notes</a>
              <a href="/rss.xml">RSS</a>
            </nav>
          </header>
          <main>${raw(content)}</main>
          <footer class="site-footer">
            <p>© ${new Date().getFullYear()} ${config.SITE_NAME}. Published from a small Node app.</p>
          </footer>
        </div>
      </body>
    </html>`.toString();
}
