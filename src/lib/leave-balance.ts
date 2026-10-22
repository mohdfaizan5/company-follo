type PolicyBalanceInput = { annual_allowance: string | number; accrues: boolean; carry_forward_limit: string | number; created_at: string }
type ApprovedLeave = { start_date: string; duration_days: string | number }

function monthsEligible(startDate: string, year: number, throughMonth: number) {
  if (startDate > `${year}-${String(throughMonth).padStart(2, '0')}-31`) return 0
  const firstMonth = startDate.slice(0, 4) === String(year) ? Number(startDate.slice(5, 7)) : 1
  return Math.max(0, throughMonth - firstMonth + 1)
}

export function leaveBalance(policy: PolicyBalanceInput, joined: string, approved: ApprovedLeave[], asOf: string) {
  const year = Number(asOf.slice(0, 4))
  const month = Number(asOf.slice(5, 7))
  const annual = Number(policy.annual_allowance)
  const earned = policy.accrues ? annual * monthsEligible(joined, year, month) / 12 : joined <= asOf ? annual : 0
  const priorYear = year - 1
  const priorEligible = joined <= `${priorYear}-12-31` && policy.created_at.slice(0, 4) <= String(priorYear)
  const priorEarned = priorEligible ? policy.accrues ? annual * monthsEligible(joined, priorYear, 12) / 12 : annual : 0
  const priorUsed = approved.filter((item) => item.start_date.startsWith(`${priorYear}-`)).reduce((sum, item) => sum + Number(item.duration_days), 0)
  const carried = Math.min(Number(policy.carry_forward_limit), Math.max(0, priorEarned - priorUsed))
  const used = approved.filter((item) => item.start_date.startsWith(`${year}-`)).reduce((sum, item) => sum + Number(item.duration_days), 0)
  return { earned: round(earned), carried: round(carried), used: round(used), available: round(earned + carried - used) }
}

function round(value: number) { return Math.round(value * 10) / 10 }
