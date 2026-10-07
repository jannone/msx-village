PRAGMA foreign_keys = ON;
CREATE TABLE invitations (
  hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  invitation_hash TEXT NOT NULL UNIQUE REFERENCES invitations(hash),
  created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE plots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  x INTEGER NOT NULL CHECK(x BETWEEN -30000 AND 30000),
  y INTEGER NOT NULL CHECK(y BETWEEN -30000 AND 30000),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  content TEXT NOT NULL CHECK(json_valid(content)),
  updated_at INTEGER NOT NULL,
  UNIQUE(x, y)
);
CREATE TABLE settlement_revisions (
  plot_id TEXT NOT NULL REFERENCES plots(id),
  revision INTEGER NOT NULL,
  content TEXT NOT NULL CHECK(json_valid(content)),
  saved_at INTEGER NOT NULL,
  PRIMARY KEY(plot_id, revision)
);
CREATE TABLE custom_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('tile', 'sprite', 'avatar')),
  created_at INTEGER NOT NULL
);
CREATE TABLE custom_asset_revisions (
  asset_id TEXT NOT NULL REFERENCES custom_assets(id),
  revision INTEGER NOT NULL,
  format_version INTEGER NOT NULL,
  patterns BLOB NOT NULL,
  colors BLOB NOT NULL,
  frame_count INTEGER NOT NULL CHECK(frame_count > 0),
  PRIMARY KEY(asset_id, revision)
);
CREATE TABLE settlement_asset_references (
  plot_id TEXT NOT NULL,
  settlement_revision INTEGER NOT NULL,
  asset_id TEXT NOT NULL,
  asset_revision INTEGER NOT NULL,
  PRIMARY KEY(plot_id, settlement_revision, asset_id),
  FOREIGN KEY(plot_id, settlement_revision) REFERENCES settlement_revisions(plot_id, revision),
  FOREIGN KEY(asset_id, asset_revision) REFERENCES custom_asset_revisions(asset_id, revision)
);
CREATE TABLE request_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
