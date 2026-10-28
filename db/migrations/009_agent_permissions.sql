-- Agent is its own permission surface. Its rights are combined with the
-- underlying area (People, Calendar, Docs, or Payroll) at tool execution time.
ALTER TABLE company_role_permissions
  DROP CONSTRAINT IF EXISTS company_role_permissions_resource_check;

ALTER TABLE company_role_permissions
  ADD CONSTRAINT company_role_permissions_resource_check
  CHECK (resource IN ('overview', 'people', 'calendar', 'docs', 'payroll', 'expenses', 'agent'));
