-- PostgreSQL normally permits multiple NULLs in a unique constraint.
-- The original constraint opted out of that behavior, preventing a second
-- person with no work email from being added to the same organization.
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_organization_id_work_email_key;
ALTER TABLE people ADD CONSTRAINT people_organization_id_work_email_key UNIQUE (organization_id, work_email);
