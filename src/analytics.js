/**
 * analytics.js -- All aggregation logic lives here.
 *
 * Components call these functions with already-decrypted data from the DAL.
 * Nothing here imports Firebase or touches Firestore directly.
 * Nothing here encrypts or decrypts.
 */

import { startOfMonth, endOfMonth, subMonths, format, isBefore } from 'date-fns'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value) {
  // Firestore Timestamps have a .toDate() method; JS Dates pass through
  if (value && typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  return new Date(value)
}

function inMonth(item, year, month) {
  const d = toDate(item.date)
  return d.getFullYear() === year && d.getMonth() === month
}

// ---------------------------------------------------------------------------
// Monthly totals
// ---------------------------------------------------------------------------

/**
 * Total spend for a given month.
 * @param {Array} expenses - Decrypted expense docs
 * @param {number} year
 * @param {number} month - 0-indexed
 */
export function monthlyExpenseTotal(expenses, year, month) {
  return expenses
    .filter((e) => inMonth(e, year, month))
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}

/**
 * Total income for a given month.
 */
export function monthlyIncomeTotal(incomeItems, year, month) {
  return incomeItems
    .filter((e) => inMonth(e, year, month))
    .reduce((sum, e) => sum + (e.amount || 0), 0)
}

/**
 * Net position (income - expenses) for a given month.
 */
export function monthlyNet(expenses, incomeItems, year, month) {
  return (
    monthlyIncomeTotal(incomeItems, year, month) -
    monthlyExpenseTotal(expenses, year, month)
  )
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

/**
 * Spend by category for a given month.
 * @returns {Array} [{ categoryId, total }] sorted descending by total
 */
export function categoryBreakdown(expenses, year, month) {
  const map = {}
  expenses
    .filter((e) => inMonth(e, year, month))
    .forEach((e) => {
      map[e.categoryId] = (map[e.categoryId] || 0) + (e.amount || 0)
    })
  return Object.entries(map)
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total)
}

// ---------------------------------------------------------------------------
// 12-month trend (for line chart on Dashboard)
// ---------------------------------------------------------------------------

/**
 * Monthly spend totals for the last N months (default 12), newest last.
 * @returns {Array} [{ month: 'Jan', year: 2025, total: number }]
 */
export function last12MonthsTrend(expenses, n = 12) {
  const now = new Date()
  const result = []
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    const year = d.getFullYear()
    const month = d.getMonth()
    result.push({
      month: format(d, 'MMM'),
      year,
      total: monthlyExpenseTotal(expenses, year, month),
    })
  }
  return result
}

// ---------------------------------------------------------------------------
// Category vs month heatmap
// ---------------------------------------------------------------------------

/**
 * Spend grid: { categoryId -> { 'Jan 2025' -> total } }
 * Used for the heatmap on Dashboard.
 */
export function categoryMonthHeatmap(expenses, categoryIds, n = 12) {
  const now = new Date()
  const grid = {}
  categoryIds.forEach((id) => {
    grid[id] = {}
  })

  for (let i = 0; i < n; i++) {
    const d = subMonths(now, i)
    const year = d.getFullYear()
    const month = d.getMonth()
    const label = format(d, 'MMM yy')

    categoryIds.forEach((id) => {
      const total = expenses
        .filter((e) => inMonth(e, year, month) && e.categoryId === id)
        .reduce((sum, e) => sum + (e.amount || 0), 0)
      grid[id][label] = total
    })
  }
  return grid
}

// ---------------------------------------------------------------------------
// Budget progress
// ---------------------------------------------------------------------------

/**
 * For each active budget, compute spend this month and percent used.
 * @param {Array} budgets - Decrypted budget docs
 * @param {Array} expenses - Decrypted expense docs
 * @param {number} year
 * @param {number} month
 * @returns {Array} [{ ...budget, spent, percentUsed, isOver80, isOver100 }]
 */
export function budgetProgress(budgets, expenses, year, month) {
  return budgets
    .filter((b) => b.isActive)
    .map((b) => {
      const spent = expenses
        .filter((e) => inMonth(e, year, month) && e.categoryId === b.categoryId)
        .reduce((sum, e) => sum + (e.amount || 0), 0)
      const percentUsed = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0
      return {
        ...b,
        spent,
        percentUsed,
        isOver80: percentUsed >= 80,
        isOver100: percentUsed >= 100,
      }
    })
}

// ---------------------------------------------------------------------------
// Outstanding loans
// ---------------------------------------------------------------------------

/**
 * Returns outstanding loans, flagging overdue ones.
 */
export function outstandingLoans(loans) {
  const now = new Date()
  return loans
    .filter((l) => !l.isReturned)
    .map((l) => ({
      ...l,
      isOverdue: isBefore(toDate(l.expectedReturnDate), now),
    }))
}

// ---------------------------------------------------------------------------
// Investment portfolio summary
// ---------------------------------------------------------------------------

/**
 * Total invested and total current value across all investments.
 */
export function portfolioSummary(investments) {
  const totalInvested = investments.reduce((s, i) => s + (i.amountInvested || 0), 0)
  const totalCurrent = investments.reduce(
    (s, i) => s + (i.currentValue != null ? i.currentValue : i.amountInvested || 0),
    0
  )
  return { totalInvested, totalCurrent, gain: totalCurrent - totalInvested }
}

// ---------------------------------------------------------------------------
// EMI summary
// ---------------------------------------------------------------------------

/**
 * Total remaining liability across all active EMIs.
 */
export function totalEmiLiability(emis) {
  return emis.reduce((s, e) => s + (e.emiAmount || 0) * (e.monthsRemaining || 0), 0)
}
