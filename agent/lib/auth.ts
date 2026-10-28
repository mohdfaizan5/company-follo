import { betterAuth } from 'better-auth'
import { Pool, neonConfig } from '@neondatabase/serverless'
import type { Pool as PgPool } from 'pg'
import ws from 'ws'

const connectionString = process.env.DATABASE_URL

if (!connectionString)
  throw new Error('DATABASE_URL is required for the Eve agent.')

/**
 * Eve compiles separately from TanStack Start, so it cannot import the
 * TanStack cookie plugin. Better Auth's core getSession API only needs the
 * same database and incoming cookie headers to validate this app's sessions.
 */
neonConfig.webSocketConstructor = ws
const pool = new Pool({ connectionString })

export const agentAuth = betterAuth({
  database: pool as unknown as PgPool,
  emailAndPassword: { enabled: true },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
})
