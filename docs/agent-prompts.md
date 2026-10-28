# CompanyFollo Agent prompt guide

CompanyFollo Agent is a permission-aware workspace assistant. It only sees the signed-in user's company and only performs a change after the user approves the confirmation card shown in Agent.

## Ask for an overview

- `Give me a company snapshot.`
- `What needs my attention this week?`
- `How many pending leave requests are there?`

## Find people

- `Find people in engineering.`
- `Who is the product designer?`
- `Show me Priya's profile.`
- `Who started this month?`

Person and document links in an answer open the relevant CompanyFollo page in a new tab.

## Understand the calendar

- `What holidays and leave are coming up in the next 30 days?`
- `Show pending leave requests.`
- `What is on the company calendar next week?`

## Find company knowledge

- `Find our onboarding SOP.`
- `What published policies do we have?`
- `Show recent company documents.`

## Create a person — confirmation required

Give the details in one prompt so the Agent does not need to guess.

```text
Add Aisha Khan as Product Designer. Work email: aisha@company.com.
Personal email: aisha@example.com. Start date: 2026-11-03.
```

Required: name, role, start date. Optional: work email and personal email.

## Add a holiday — confirmation required

```text
Add Diwali as a public holiday on 2026-11-08.
```

Required: name and date. Say `company holiday` or `public holiday` when it matters.

## Start a company document — confirmation required

```text
Create a private SOP named “New hire equipment checklist”.
```

Supported kinds: `policy`, `SOP`, `guide`, and `general`. The Agent creates a blank private draft; write, review, and publish it in Docs.

## Record a payment — confirmation required

First identify the person if needed, then provide the complete payment instruction.

```text
Find Aisha Khan, then record an INR 85,000 Salary payment for October 2026,
paid on 2026-10-31.
```

Include: person, amount, `INR` or `USD`, one of `Salary`, `Stipend`, `Bonus`, or `Reimbursement`, and a status (`draft`, `scheduled`, or `paid`). Paid payments also need their payment date.

## Requests Agent deliberately redirects

These remain in their dedicated workflows so the user gets the right review surface:

- Approving, declining, recording, or cancelling leave → Calendar
- Invitations, role changes, and employee documents → People
- Editing or publishing document contents → Docs
- Deleting people, payments, holidays, documents, or company data → the relevant product screen
- Company switcher, permissions, work week, and company settings → Settings

## Permissions

Agent is an area in **Settings → Permissions**. Opening Agent requires `Agent → Read`. A lookup also needs the relevant area’s `Read` permission; a change needs both `Agent → Write` and the relevant area’s `Write` permission. Owners always retain full access.
