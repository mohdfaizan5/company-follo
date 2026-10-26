-- Working days per company, using JavaScript day numbers (0 = Sunday … 6 = Saturday).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}';

-- paid: counts against an accruing balance. unpaid: no balance. wfh: working remotely, not time off.
ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'paid';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_policies_category_check') THEN
    ALTER TABLE leave_policies ADD CONSTRAINT leave_policies_category_check CHECK (category IN ('paid', 'unpaid', 'wfh'));
  END IF;
END $$;

-- public: a government / national holiday. company: a day off the company chose.
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'company';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'holidays_kind_check') THEN
    ALTER TABLE holidays ADD CONSTRAINT holidays_kind_check CHECK (kind IN ('public', 'company'));
  END IF;
END $$;
