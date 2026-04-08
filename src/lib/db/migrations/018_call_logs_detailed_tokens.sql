-- Migration 018: Add detailed token breakdown fields for call logs
-- Keep fields nullable so UI can distinguish:
-- - NULL => provider did not report this metric (N/A)
-- - 0    => provider explicitly reported zero

ALTER TABLE call_logs ADD COLUMN tokens_cache_read INTEGER DEFAULT NULL;
ALTER TABLE call_logs ADD COLUMN tokens_cache_creation INTEGER DEFAULT NULL;
ALTER TABLE call_logs ADD COLUMN tokens_reasoning INTEGER DEFAULT NULL;
