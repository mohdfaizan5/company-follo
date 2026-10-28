import { generateReactHelpers } from '@uploadthing/react'
import type { UploadRouter } from '#/lib/uploadthing-server'

/**
 * UploadThing expects JSON from its route for every upload step. TanStack's
 * development error page is HTML, which otherwise becomes the opaque
 * "Failed to parse response" client error. Preserve the HTTP status and give
 * the caller a safe, actionable message instead.
 */
const uploadThingFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers)
  // These observability headers are optional. Removing them keeps the authenticated
  // browser POST under conservative dev-server header limits without affecting
  // UploadThing's signed upload or the Better Auth session cookie.
  headers.delete('b3')
  headers.delete('traceparent')
  const response = await fetch(input, { ...init, headers })
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) return response

  const status = response.status || 500
  const statusText = response.statusText || 'Unknown server error'
  const message =
    status === 431
      ? 'The browser sent too many authentication headers. Sign out, clear old CompanyFollo cookies for localhost, then sign in again.'
      : `The upload server returned ${status} ${statusText}. Check the UploadThing token and restart the server.`
  return Response.json(
    {
      message,
    },
    { status },
  )
}

export const { useUploadThing } = generateReactHelpers<UploadRouter>({
  url: '/api/uploadthing',
  fetch: uploadThingFetch,
})
