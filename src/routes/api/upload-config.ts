import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/upload-config')({ server: { handlers: { GET: () => Response.json({ enabled: Boolean(process.env.UPLOADTHING_TOKEN) }) } } })
