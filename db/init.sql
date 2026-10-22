-- CompanyFollo foundation schema (v1).
-- The schema is ready for the product scope, but application features are added incrementally.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE companyfollo_member_role AS ENUM ('owner', 'hr_admin', 'employee');
CREATE TYPE companyfollo_employment_status AS ENUM ('active', 'on_leave', 'ended');
CREATE TYPE companyfollo_currency AS ENUM ('INR', 'USD');
CREATE TYPE companyfollo_compensation_kind AS ENUM ('salary', 'bonus', 'adjustment');
CREATE TYPE companyfollo_payment_status AS ENUM ('draft', 'scheduled', 'paid', 'void');
CREATE TYPE companyfollo_leave_unit AS ENUM ('days', 'half_days');
CREATE TYPE companyfollo_leave_request_status AS ENUM ('pending', 'approved', 'declined', 'cancelled');
CREATE TYPE companyfollo_document_kind AS ENUM ('offer_letter', 'employment_document', 'identity', 'other');

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, legal_name TEXT, default_currency companyfollo_currency NOT NULL DEFAULT 'INR', country_code CHAR(2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
-- app_user_id will point to Better Auth once persisted auth is enabled.
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  app_user_id TEXT NOT NULL, role companyfollo_member_role NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, app_user_id)
);
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL, last_name TEXT, work_email TEXT, phone_number TEXT, personal_email TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, work_email)
);
CREATE TABLE employments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, title TEXT NOT NULL, department TEXT, level TEXT,
  manager_employment_id UUID REFERENCES employments(id) ON DELETE SET NULL,
  start_date DATE NOT NULL, end_date DATE, status companyfollo_employment_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE TABLE compensation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
  kind companyfollo_compensation_kind NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0), currency companyfollo_currency NOT NULL,
  effective_from DATE NOT NULL, effective_to DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
  compensation_record_id UUID REFERENCES compensation_records(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0), currency companyfollo_currency NOT NULL, paid_on DATE,
  period_start DATE, period_end DATE, status companyfollo_payment_status NOT NULL DEFAULT 'draft', notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);
CREATE TABLE leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, annual_allowance NUMERIC(5,1) NOT NULL CHECK (annual_allowance >= 0), accrues BOOLEAN NOT NULL DEFAULT true,
  accrual_per_month NUMERIC(5,2), carry_forward_limit NUMERIC(5,1) NOT NULL DEFAULT 0 CHECK (carry_forward_limit >= 0),
  unit companyfollo_leave_unit NOT NULL DEFAULT 'days', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT accrues OR accrual_per_month IS NOT NULL)
);
CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
  leave_policy_id UUID NOT NULL REFERENCES leave_policies(id) ON DELETE CASCADE, year SMALLINT NOT NULL CHECK (year >= 2000),
  opening_balance NUMERIC(5,1) NOT NULL DEFAULT 0, accrued NUMERIC(5,1) NOT NULL DEFAULT 0, used NUMERIC(5,1) NOT NULL DEFAULT 0,
  UNIQUE (employment_id, leave_policy_id, year)
);
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, holiday_date DATE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (company_id, holiday_date)
);
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employment_id UUID NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
  leave_policy_id UUID NOT NULL REFERENCES leave_policies(id) ON DELETE RESTRICT, start_date DATE NOT NULL, end_date DATE NOT NULL,
  duration_days NUMERIC(4,1) NOT NULL CHECK (duration_days > 0), reason TEXT,
  status companyfollo_leave_request_status NOT NULL DEFAULT 'pending',
  created_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL DEFAULT 'request' CHECK (entry_type IN ('request', 'recorded')),
  reviewed_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL, reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK (end_date >= start_date)
);
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employment_id UUID REFERENCES employments(id) ON DELETE SET NULL, amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency companyfollo_currency NOT NULL, incurred_on DATE NOT NULL, label TEXT NOT NULL, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- UploadThing stores bytes; only secure metadata is stored here.
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  kind companyfollo_document_kind NOT NULL, file_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL,
  content_type TEXT NOT NULL, size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL, entity_type TEXT NOT NULL, entity_id UUID NOT NULL,
  action TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX employments_company_active_idx ON employments (company_id, status);
CREATE INDEX compensation_employment_effective_idx ON compensation_records (employment_id, effective_from DESC);
CREATE INDEX payments_employment_period_idx ON payments (employment_id, period_end DESC);
CREATE INDEX leave_requests_status_start_idx ON leave_requests (status, start_date);
CREATE INDEX expenses_company_incurred_idx ON expenses (company_id, incurred_on DESC);
CREATE INDEX documents_person_idx ON documents (person_id) WHERE person_id IS NOT NULL;
