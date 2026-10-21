-- Versioned migrations are applied after the immutable init schema.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_loans_overdue_report ON loans (due_date) WHERE returned_at IS NULL;

INSERT INTO schema_migrations (version) VALUES ('001_monitoring_and_user_indexes') ON CONFLICT DO NOTHING;
