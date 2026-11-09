import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Digest and article bodies are our own trusted markdown (authored by us or by
// the pipeline), so we render them to HTML directly. GitHub-flavored line breaks
// on; async off so parse returns a string synchronously.
marked.use({ gfm: true, breaks: false, async: false });

export function mdToHtml(md: string): string {
  return sanitizeHtml(marked.parse(md, { async: false }) as string);
}

/** A short plain-text excerpt from markdown, for list pages and previews. */
export function excerpt(md: string, maxChars = 200): string {
  const text = md
    .replace(/^#.*$/gm, '') // drop heading lines
    .replace(/[*_`>#-]/g, '') // strip common markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;
}
