-- Migration 021: Canonicalize memory storage with backward-compatible legacy view

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('factual', 'episodic', 'procedural', 'semantic')),
  key TEXT,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_api_key ON memories(api_key_id);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);

-- Legacy compatibility: expose previous camelCase "memory" surface as a writable view.
CREATE VIEW IF NOT EXISTS memory AS
SELECT
  id,
  api_key_id AS apiKeyId,
  session_id AS sessionId,
  type,
  key,
  content,
  metadata,
  created_at AS createdAt,
  updated_at AS updatedAt,
  expires_at AS expiresAt
FROM memories;

CREATE TRIGGER IF NOT EXISTS trg_memory_insert
INSTEAD OF INSERT ON memory
BEGIN
  INSERT INTO memories (
    id,
    api_key_id,
    session_id,
    type,
    key,
    content,
    metadata,
    created_at,
    updated_at,
    expires_at
  )
  VALUES (
    NEW.id,
    NEW.apiKeyId,
    NEW.sessionId,
    NEW.type,
    NEW.key,
    NEW.content,
    NEW.metadata,
    COALESCE(NEW.createdAt, datetime('now')),
    COALESCE(NEW.updatedAt, datetime('now')),
    NEW.expiresAt
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_memory_update
INSTEAD OF UPDATE ON memory
BEGIN
  UPDATE memories
  SET
    api_key_id = COALESCE(NEW.apiKeyId, OLD.apiKeyId),
    session_id = COALESCE(NEW.sessionId, OLD.sessionId),
    type = COALESCE(NEW.type, OLD.type),
    key = COALESCE(NEW.key, OLD.key),
    content = COALESCE(NEW.content, OLD.content),
    metadata = COALESCE(NEW.metadata, OLD.metadata),
    created_at = COALESCE(NEW.createdAt, OLD.createdAt),
    updated_at = COALESCE(NEW.updatedAt, datetime('now')),
    expires_at = CASE
      WHEN NEW.expiresAt IS NULL AND OLD.expiresAt IS NOT NULL THEN NULL
      WHEN NEW.expiresAt IS NOT NULL THEN NEW.expiresAt
      ELSE OLD.expiresAt
    END
  WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_memory_delete
INSTEAD OF DELETE ON memory
BEGIN
  DELETE FROM memories WHERE id = OLD.id;
END;
