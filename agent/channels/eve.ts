import { eveChannel } from 'eve/channels/eve'
import type { AuthFn } from 'eve/channels/auth'
import { agentAuth } from '../lib/auth'

/**
 * Eve routes receive the same Better Auth cookie as the TanStack app.
 * Returning null means Eve fails closed with a 401 response.
 */
const companyFolloSession: AuthFn<Request> = async (request) => {
  const session = await agentAuth.api.getSession({ headers: request.headers })
  if (!session?.user) return null

  return {
    authenticator: 'companyfollo',
    principalId: session.user.id,
    principalType: 'user',
    attributes: {
      email: session.user.email,
      name: session.user.name,
    },
  }
}

export default eveChannel({ auth: companyFolloSession })
