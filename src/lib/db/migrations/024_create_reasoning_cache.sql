-- Migration 024: reasoning replay cache persistence

CREATE TABLE IF NOT EXISTS reasoning_cache (
  tool_call_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (tool_call_id, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_reasoning_cache_expires_at ON reasoning_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_reasoning_cache_provider ON reasoning_cache(provider);
CREATE INDEX IF NOT EXISTS idx_reasoning_cache_model ON reasoning_cache(model);
