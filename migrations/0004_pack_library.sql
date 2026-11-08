CREATE TABLE pack_library (
  pack_id TEXT PRIMARY KEY REFERENCES packs(id),
  owner TEXT NOT NULL,
  collection TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX pack_library_owner ON pack_library(owner);
CREATE INDEX session_pack ON sessions(pack_id,owner,status,started_at);
