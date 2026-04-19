-- Migration 023: Guarded summary-only call log storage toggle (default off)

INSERT OR IGNORE INTO key_value (namespace, key, value)
VALUES ('settings', 'call_log_summary_storage_enabled', 'false');
