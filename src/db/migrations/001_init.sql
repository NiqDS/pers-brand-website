-- posts: both AI-produced weekly digests and hand-written articles/notes
CREATE TABLE posts (
  id           INTEGER PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('digest','article','note')),
  title        TEXT NOT NULL,
  body_md      TEXT NOT NULL,           -- markdown
  theme        TEXT,                    -- for digests: the theme/topic used
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at   TEXT NOT NULL,           -- ISO8601
  published_at TEXT
);

CREATE INDEX idx_posts_status_published ON posts (status, published_at);
CREATE INDEX idx_posts_kind ON posts (kind);

CREATE TABLE subscribers (
  id            INTEGER PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','unsubscribed')),
  confirm_token TEXT NOT NULL,          -- random; double opt-in + unsubscribe
  created_at    TEXT NOT NULL,
  confirmed_at  TEXT
);

CREATE INDEX idx_subscribers_status ON subscribers (status);

-- audit of what got sent/pushed where (so a re-run never double-sends)
CREATE TABLE deliveries (
  id         INTEGER PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id),
  channel    TEXT NOT NULL,             -- 'email' | 'substack' | 'linkedin'
  status     TEXT NOT NULL,             -- 'sent' | 'failed' | 'skipped'
  detail     TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_deliveries_post_channel ON deliveries (post_id, channel);

-- arcs: one weekly editorial arc (the pipeline's unit of work).
-- A week's topic + thesis + source notes expand into the four movements.
CREATE TABLE arcs (
  id           INTEGER PRIMARY KEY,
  week_number  INTEGER NOT NULL,
  topic        TEXT NOT NULL,           -- the arc title / question
  thesis       TEXT NOT NULL,           -- the week's conclusion
  source_notes TEXT NOT NULL DEFAULT '', -- research notes the drafts are grounded in
  tease        TEXT NOT NULL DEFAULT '', -- next week's tease
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  post_id      INTEGER REFERENCES posts(id), -- the published Friday Substack article
  created_at   TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX idx_arcs_week ON arcs (week_number);

-- drafts: the generated movements for an arc.
CREATE TABLE drafts (
  id         INTEGER PRIMARY KEY,
  arc_id     INTEGER NOT NULL REFERENCES arcs(id) ON DELETE CASCADE,
  movement   TEXT NOT NULL CHECK (movement IN ('tue','thu','fri-li','fri-sub','brief')),
  body_md    TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (arc_id, movement)
);
