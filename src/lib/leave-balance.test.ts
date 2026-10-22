import { expect, test } from 'bun:test'
import { leaveBalance } from './leave-balance'

test('accrues monthly and carries only unused prior-year leave up to the cap', () => {
  const balance = leaveBalance(
    { annual_allowance: 24, accrues: true, carry_forward_limit: 5, created_at: '2024-01-01' },
    '2025-01-01',
    [{ start_date: '2025-10-10', duration_days: 20 }, { start_date: '2026-01-12', duration_days: 1 }],
    '2026-02-15',
  )
  expect(balance).toEqual({ earned: 4, carried: 4, used: 1, available: 7 })
})

test('does not carry leave from before employment or before policy creation', () => {
  const balance = leaveBalance(
    { annual_allowance: 12, accrues: false, carry_forward_limit: 5, created_at: '2026-01-01' },
    '2026-01-10', [], '2026-02-15',
  )
  expect(balance).toEqual({ earned: 12, carried: 0, used: 0, available: 12 })
})
