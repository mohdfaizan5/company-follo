-- What a payment was for (Salary, Bonus, Reimbursement, or any type the company adds) and where it was paid.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Salary';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS region TEXT;
CREATE INDEX IF NOT EXISTS payments_type_region_idx ON payments (type, region);
