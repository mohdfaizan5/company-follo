# CompanyFollo's Eve starter agent

This is a deliberately small, production-shaped Eve setup. It is read-only and gives you four clear extension points instead of hiding agent behavior behind one giant prompt.

## How a message moves through the app

```text
/dashboard/assistant
  → useEveAgent() in src/components/company-assistant.tsx
  → /eve/v1/* (mounted by eveTanStack() in vite.config.ts)
  → agent/channels/eve.ts validates the Better Auth session cookie
  → agent/instructions.md guides the model
  → agent/tools/get_company_snapshot.ts reads only the caller's company
  → streamed response returns to the React component
```

## Files to read in order

1. `agent/instructions.md` — the always-on role and safety boundaries.
2. `agent/channels/eve.ts` — turns the existing Better Auth session into Eve's authenticated principal. It fails closed when the user is not signed in. Its small `agent/lib/auth.ts` adapter uses Better Auth core because Eve is compiled as a separate service and must not import TanStack Start's runtime-only adapter.
3. `agent/tools/get_company_snapshot.ts` — a named, typed, read-only tool. The model does not receive a company ID; the tool derives the user and company from the authenticated session. `agent/agent.ts` explicitly turns off Eve's optional shell, file, and web tools, so this is the only business-data capability.
4. `src/components/company-assistant.tsx` — the minimal UI around `useEveAgent()`. It renders streamed messages and sends a prompt.
5. `vite.config.ts` — `eveTanStack()` mounts Eve on the same local origin as the TanStack Start app.

## Run it locally

Add `AI_GATEWAY_API_KEY` to `.env.local`, then restart `bun run dev`. Sign into CompanyFollo and open `/dashboard/assistant`.

The agent requires your existing `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` too. The assistant's route is not public: Eve receives the same Better Auth cookie as the app and returns 401 without one.

## Safe next additions

- Add another read-only tool, such as `agent/tools/list_upcoming_holidays.ts`.
- Add an explicit approval gate before any write tool. Do not turn an existing read tool into a write tool.
- Add a skill in `agent/skills/` for a specialised process (for example, interpreting leave policies).
- Add an eval in `agent/evals/` before making the assistant more autonomous.

## Important limitation

This starter intentionally does **not** create employees, approve leave, or change payroll. It explains where to make those changes in the product. Keep the tool's principal-derived tenant filter whenever you add company data.
