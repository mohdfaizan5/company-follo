ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS created_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL;

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'request';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_entry_type_check') THEN
    ALTER TABLE leave_requests
      ADD CONSTRAINT leave_requests_entry_type_check CHECK (entry_type IN ('request', 'recorded'));
  END IF;
END $$;
