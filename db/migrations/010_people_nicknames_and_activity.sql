-- A friendly display name and a durable, person-scoped timeline.  `audit_log`
-- remains the broader company audit record; this table is what the profile shows.
ALTER TABLE people ADD COLUMN IF NOT EXISTS nickname TEXT;

CREATE TABLE IF NOT EXISTS person_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('changed', 'commented')),
  summary TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_activity_person_created_idx
  ON person_activity (person_id, created_at DESC);
