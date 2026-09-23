CREATE TABLE IF NOT EXISTS synchronization_runs (
  id uuid PRIMARY KEY,
  scope varchar(16) NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'interrupted')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}',
  errors jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS synchronization_runs_started_idx ON synchronization_runs(started_at);
