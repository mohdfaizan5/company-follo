import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Pool, neonConfig } from '@neondatabase/serverless'
import type { Pool as PgPool } from 'pg'
import ws from 'ws'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required for authentication.')
}

neonConfig.webSocketConstructor = ws
const pool = new Pool({ connectionString })

export const auth = betterAuth({
  // Neon exposes pg-compatible Pool behavior with a narrower Client.connect type.
  database: pool as unknown as PgPool,
  emailAndPassword: {
    enabled: true,
  },
  session: {
    // Sessions are verified from a signed cookie for 5 minutes, so most requests skip the database round trips.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [tanstackStartCookies()],
})
