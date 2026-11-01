CREATE TABLE curriculum_blocks (id TEXT PRIMARY KEY, year INTEGER NOT NULL, label TEXT NOT NULL, topic_block TEXT NOT NULL, status TEXT NOT NULL, source_name TEXT NOT NULL, source_hash TEXT NOT NULL, imported_at TEXT NOT NULL);
CREATE TABLE curriculum_items (id TEXT PRIMARY KEY, block_id TEXT NOT NULL REFERENCES curriculum_blocks(id), source_label TEXT NOT NULL, source_type TEXT NOT NULL, topic_id TEXT REFERENCES topics(id), section TEXT NOT NULL, priority TEXT NOT NULL, source_locator TEXT NOT NULL, match_method TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '');
CREATE INDEX curriculum_topic ON curriculum_items(topic_id);
CREATE INDEX curriculum_block ON curriculum_items(block_id);
