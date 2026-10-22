import { createUploadthing, UploadThingError } from 'uploadthing/server'
import type { FileRouter } from 'uploadthing/server'
import { z } from 'zod'
import { requireCompanyAccess, validUuid } from '#/lib/server-workspace'

const f = createUploadthing()
async function personScope(request: Request, personId: string) {
  const scope = await requireCompanyAccess(request, 'people', 'write')
  if ('error' in scope || !validUuid(personId)) throw new UploadThingError('Unauthorized')
  const person = (await scope.sql`
    SELECT p.id FROM people p JOIN employments e ON e.person_id = p.id
    WHERE p.id = ${personId}::uuid AND e.company_id = ${scope.company.company_id}
  `).at(0)
  if (!person) throw new UploadThingError('Person not found')
  return { personId, companyId: String(scope.company.company_id), organizationId: String(scope.company.organization_id), userId: scope.userId }
}

export const uploadRouter = {
  employeePhoto: f({ image: { maxFileSize: '4MB', maxFileCount: 1, acl: 'public-read' } }, { awaitServerData: true })
    .input(z.object({ personId: z.uuid() }))
    .middleware(async ({ req, input }) => personScope(req, input.personId))
    .onUploadComplete(async ({ file, metadata }) => {
      const { getClient } = await import('#/db')
      const sql = await getClient()
      if (!sql) throw new UploadThingError('Database unavailable')
      await sql`UPDATE people SET avatar_file_key = ${file.key}, avatar_url = ${file.ufsUrl}, updated_at = now() WHERE id = ${metadata.personId}::uuid AND organization_id = ${metadata.organizationId}::uuid`
      return { key: file.key }
    }),
  employeeDocument: f({ pdf: { maxFileSize: '16MB', maxFileCount: 1, acl: 'private' }, image: { maxFileSize: '8MB', maxFileCount: 1, acl: 'private' } }, { awaitServerData: true })
    .input(z.object({ personId: z.uuid(), displayName: z.string().trim().min(1).max(120), kind: z.enum(['offer_letter', 'employment_document', 'identity', 'other']) }))
    .middleware(async ({ req, input }) => ({ ...await personScope(req, input.personId), displayName: input.displayName, kind: input.kind }))
    .onUploadComplete(async ({ file, metadata }) => {
      const { getClient } = await import('#/db')
      const sql = await getClient()
      if (!sql) throw new UploadThingError('Database unavailable')
      await sql`
        INSERT INTO documents (organization_id, company_id, person_id, kind, file_key, file_name, content_type, size_bytes, display_name, uploaded_by_user_id)
        VALUES (${metadata.organizationId}::uuid, ${metadata.companyId}::uuid, ${metadata.personId}::uuid,
          ${metadata.kind}::companyfollo_document_kind, ${file.key}, ${file.name}, ${file.type}, ${file.size}, ${metadata.displayName}, ${metadata.userId})
      `
      return { key: file.key }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
