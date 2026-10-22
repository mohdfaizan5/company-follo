ALTER TABLE companies ADD COLUMN IF NOT EXISTS public_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS companies_public_slug_idx ON companies (public_slug) WHERE public_slug IS NOT NULL;

ALTER TABLE people ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS avatar_file_key TEXT;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT;

CREATE TABLE IF NOT EXISTS handbook_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  slug TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'policy', 'sop', 'guide')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);
CREATE INDEX IF NOT EXISTS handbook_documents_company_idx ON handbook_documents (company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS leave_requests_employment_idx ON leave_requests (employment_id, start_date);
ALTER TABLE leave_policies ADD COLUMN IF NOT EXISTS allow_half_days BOOLEAN NOT NULL DEFAULT true;
