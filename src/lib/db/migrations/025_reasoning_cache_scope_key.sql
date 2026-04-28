-- Migration 025: enforce scoped key for reasoning cache

CREATE TABLE IF NOT EXISTS reasoning_cache_v2 (
  tool_call_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (tool_call_id, provider, model)
);

INSERT OR REPLACE INTO reasoning_cache_v2 (
  tool_call_id,
  provider,
  model,
  reasoning,
  char_count,
  created_at,
  expires_at
)
SELECT
  tool_call_id,
  provider,
  model,
  reasoning,
  char_count,
  created_at,
  expires_at
FROM reasoning_cache;

DROP TABLE reasoning_cache;
ALTER TABLE reasoning_cache_v2 RENAME TO reasoning_cache;

CREATE INDEX IF NOT EXISTS idx_reasoning_cache_expires_at ON reasoning_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_reasoning_cache_provider ON reasoning_cache(provider);
CREATE INDEX IF NOT EXISTS idx_reasoning_cache_model ON reasoning_cache(model);
