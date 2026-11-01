CREATE TABLE study_settings (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
-- Refresh the managed spreadsheet projection after the versioned AKT rule change.
INSERT INTO sync_jobs(id,owner,next_at,updated_at)
SELECT lower(hex(randomblob(16))),owner,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM (SELECT owner FROM packs UNION SELECT owner FROM web_sessions);
