import { html, raw } from 'hono/html';
import type { Post, PostKind } from '../db/types.js';
import { mdToHtml, excerpt } from './markdown.js';

const KIND_LABEL: Record<PostKind, string> = {
  digest: 'Weekly digest',
  article: 'Article',
  note: 'Note',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Newsletter signup box, reused on the home and post pages. */
export function subscribeBox(): string {
  return html`<section class="subscribe">
    <h3>Get the weekly dispatch</h3>
    <p>One email a week: the arc's findings and a link to the full piece. Double opt-in, one-click unsubscribe.</p>
    <form method="post" action="/subscribe">
      <input type="email" name="email" placeholder="you@example.com" required aria-label="Email address" />
      <button type="submit">Subscribe</button>
    </form>
  </section>`.toString();
}

function postListItem(p: Post): string {
  return html`<li class="post-item">
    <div class="post-meta">
      <span class="tag">${KIND_LABEL[p.kind]}</span>
      <time datetime="${p.published_at ?? ''}">${fmtDate(p.published_at)}</time>
    </div>
    <h2><a href="/p/${p.slug}">${p.title}</a></h2>
    <p class="post-excerpt">${excerpt(p.body_md)}</p>
  </li>`.toString();
}

export function renderHome(posts: Post[]): string {
  if (posts.length === 0) {
    return html`${raw(subscribeBox())}
      <p class="post-excerpt">No posts yet — check back soon.</p>`.toString();
  }
  const items = posts.map(postListItem).join('');
  return html`${raw(subscribeBox())}
    <ul class="post-list">
      ${raw(items)}
    </ul>`.toString();
}

export function renderNotes(notes: Post[]): string {
  if (notes.length === 0) {
    return html`<p class="post-excerpt">No notes yet.</p>`.toString();
  }
  const items = notes.map(postListItem).join('');
  return html`<ul class="post-list">
    ${raw(items)}
  </ul>`.toString();
}

export function renderPost(p: Post): string {
  return html`<a class="back-link" href="/">← All posts</a>
    <article class="post">
      <div class="post-meta">
        <span class="tag">${KIND_LABEL[p.kind]}</span>
        <time datetime="${p.published_at ?? ''}">${fmtDate(p.published_at)}</time>
      </div>
      <h1>${p.title}</h1>
      <div class="post-body">${raw(mdToHtml(p.body_md))}</div>
    </article>
    ${raw(subscribeBox())}`.toString();
}
