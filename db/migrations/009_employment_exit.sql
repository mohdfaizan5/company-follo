-- Why and how someone left. The employment row (and everything linked to it) is kept; status = 'ended' hides it.
ALTER TABLE employments ADD COLUMN IF NOT EXISTS end_reason TEXT;
ALTER TABLE employments ADD COLUMN IF NOT EXISTS exit_note TEXT;
ALTER TABLE employments ADD COLUMN IF NOT EXISTS ended_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employments_end_reason_check') THEN
    ALTER TABLE employments ADD CONSTRAINT employments_end_reason_check
      CHECK (end_reason IS NULL OR end_reason IN ('resigned', 'let_go', 'contract_ended', 'internship_ended', 'other'));
  END IF;
END $$;
