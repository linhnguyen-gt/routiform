-- Migration 022: FTS5 index for semantic/hybrid memory retrieval

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  api_key_id UNINDEXED,
  session_id UNINDEXED,
  type UNINDEXED,
  key,
  content,
  metadata,
  tokenize = 'unicode61'
);

INSERT INTO memories_fts (id, api_key_id, session_id, type, key, content, metadata)
SELECT id, api_key_id, session_id, type, COALESCE(key, ''), COALESCE(content, ''), COALESCE(metadata, '')
FROM memories
WHERE id NOT IN (SELECT id FROM memories_fts);

CREATE TRIGGER IF NOT EXISTS trg_memories_fts_insert
AFTER INSERT ON memories
BEGIN
  INSERT INTO memories_fts (id, api_key_id, session_id, type, key, content, metadata)
  VALUES (
    NEW.id,
    NEW.api_key_id,
    NEW.session_id,
    NEW.type,
    COALESCE(NEW.key, ''),
    COALESCE(NEW.content, ''),
    COALESCE(NEW.metadata, '')
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_memories_fts_update
AFTER UPDATE ON memories
BEGIN
  DELETE FROM memories_fts WHERE id = OLD.id;
  INSERT INTO memories_fts (id, api_key_id, session_id, type, key, content, metadata)
  VALUES (
    NEW.id,
    NEW.api_key_id,
    NEW.session_id,
    NEW.type,
    COALESCE(NEW.key, ''),
    COALESCE(NEW.content, ''),
    COALESCE(NEW.metadata, '')
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_memories_fts_delete
AFTER DELETE ON memories
BEGIN
  DELETE FROM memories_fts WHERE id = OLD.id;
END;
