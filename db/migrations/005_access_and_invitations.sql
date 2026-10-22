CREATE TABLE IF NOT EXISTS company_role_permissions (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role companyfollo_member_role NOT NULL,
  resource TEXT NOT NULL CHECK (resource IN ('overview', 'people', 'calendar', 'docs', 'payroll', 'expenses')),
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_write BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, role, resource),
  CHECK (role <> 'owner'),
  CHECK (NOT can_write OR can_read)
);

CREATE TABLE IF NOT EXISTS person_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL UNIQUE REFERENCES people(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role companyfollo_member_role NOT NULL CHECK (role IN ('hr_admin', 'employee')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  created_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS person_invitations_company_idx ON person_invitations (company_id, created_at DESC);
