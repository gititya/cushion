import { useEffect, useState, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext.jsx'
import { expenses, categories, investments as investmentsDB, loans as loansDB } from '../db/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lastNMonths(n) {
  const months = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function fmtMonthLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
  })
}

function fmtRupeeShort(v) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`
  return `₹${Math.round(v)}`
}

function fmtRupeeFull(v) {
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProportionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const filtered = payload.filter((p) => p.value > 0)
  if (!filtered.length) return null
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Typography variant="caption" fontWeight={600} display="block" mb={0.5}>
        {label}
      </Typography>
      {filtered.map((p) => (
        <Box key={p.name} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box
            sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.fill, flexShrink: 0 }}
          />
          <Typography variant="caption">
            {p.name}: {p.value}%
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function CategoryTable({ monthlyData, activeCatIds, catMap }) {
  const rows = useMemo(() => {
    return activeCatIds
      .map((catId) => {
        const cat = catMap[catId]
        if (!cat) return null
        const total = monthlyData.reduce((s, d) => s + (d.byCat[catId] || 0), 0)
        return { catId, cat, total }
      })
      .filter(Boolean)
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [activeCatIds, catMap, monthlyData])

  const globalMax = useMemo(
    () => Math.max(...activeCatIds.flatMap((catId) => monthlyData.map((d) => d.byCat[catId] || 0))),
    [activeCatIds, monthlyData]
  )

  return (
    <>
      <TableContainer sx={{ maxHeight: 380, overflow: 'auto' }}>
        <Table size="small" stickyHeader sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: 'background.paper',
                  fontWeight: 600,
                  minWidth: 160,
                }}
              >
                Category
              </TableCell>
              {monthlyData.map((d) => (
                <TableCell
                  key={d.ym}
                  align="right"
                  sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}
                >
                  {fmtMonthLabel(d.ym)}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                Total
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ catId, cat, total }) => (
              <TableRow key={catId} hover>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    bgcolor: 'background.paper',
                    fontWeight: 500,
                    fontSize: 12,
                    borderLeft: `4px solid ${cat.color || '#90A4AE'}`,
                  }}
                >
                  {cat.icon} {cat.name}
                </TableCell>
                {monthlyData.map((d) => {
                  const amt = d.byCat[catId] || 0
                  const intensity = globalMax > 0 ? amt / globalMax : 0
                  const alpha = amt > 0 ? Math.round(intensity * 52 + 8) : 0
                  const alphaHex = alpha.toString(16).padStart(2, '0')
                  return (
                    <TableCell
                      key={d.ym}
                      align="right"
                      sx={{
                        fontSize: 11,
                        bgcolor: amt > 0 ? `#FF8F00${alphaHex}` : 'transparent',
                        color: amt > 0 ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {amt > 0 ? fmtRupeeShort(amt) : '—'}
                    </TableCell>
                  )
                })}
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: 11 }}>
                  {fmtRupeeShort(total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Shade intensity = spend relative to highest category-month in this period
      </Typography>
    </>
  )
}

function StatCard({ label, value, valueColor, sub }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 180 }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={700} color={valueColor || 'text.primary'}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { currentUser } = useAuth()
  const [expenseList, setExpenseList] = useState([])
  const [categoryList, setCategoryList] = useState([])
  const [assetsTotal, setAssetsTotal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState('category')

  useEffect(() => {
    async function load() {
      try {
        const [exps, cats, invs, lns] = await Promise.all([
          expenses.getAll(currentUser.uid),
          categories.getAll(currentUser.uid),
          investmentsDB.getAll(currentUser.uid),
          loansDB.getAll(currentUser.uid),
        ])
        setExpenseList(exps)
        setCategoryList(cats)

        const invTotal = invs.filter((i) => i.type !== 'fd').reduce((s, i) => s + (i.currentValue || 0), 0)
        const fdTotal = invs.filter((i) => i.type === 'fd' && i.status === 'in_progress').reduce((s, i) => s + (i.currentValue || 0), 0)
        const loansTotal = lns.reduce((s, l) => {
          const outstanding = l.manualBalance ? (l.currentBalance ?? 0) : Math.max(0, (l.amount || 0) - (l.repayments || []).reduce((r, p) => r + (p.amount || 0), 0))
          return s + outstanding
        }, 0)
        setAssetsTotal(invTotal + fdTotal + loansTotal)
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser.uid])

  const catMap = useMemo(
    () => Object.fromEntries(categoryList.map((c) => [c.id, c])),
    [categoryList]
  )

  const months = useMemo(() => lastNMonths(13), [])

  // Per-month totals + per-category breakdown
  const monthlyData = useMemo(
    () =>
      months.map((ym) => {
        const rows = expenseList.filter((e) => e.date?.startsWith(ym))
        const total = rows.reduce((s, e) => s + (e.amount || 0), 0)
        const byCat = {}
        for (const e of rows) {
          byCat[e.categoryId] = (byCat[e.categoryId] || 0) + (e.amount || 0)
        }
        return { ym, total, byCat, count: rows.length }
      }),
    [expenseList, months]
  )

  const currentMonth = monthlyData[monthlyData.length - 1]
  const prevMonth = monthlyData[monthlyData.length - 2]
  const delta = currentMonth.total - prevMonth.total

  // All category IDs that appear in any expense
  const activeCatIds = useMemo(() => {
    const seen = new Set(expenseList.map((e) => e.categoryId).filter(Boolean))
    return [...seen]
  }, [expenseList])

  // Chart data for the toggle modes
  const chartData = useMemo(() => {
    return monthlyData.map((d) => {
      const row = { month: fmtMonthLabel(d.ym) }
      if (chartMode === 'total') {
        row.Total = Math.round(d.total)
      } else if (chartMode === 'category') {
        for (const catId of activeCatIds) {
          const cat = catMap[catId]
          if (cat) row[cat.name] = Math.round(d.byCat[catId] || 0)
        }
      } else {
        // proportion — each category as % of month total
        const t = d.total || 1
        for (const catId of activeCatIds) {
          const cat = catMap[catId]
          if (cat) row[cat.name] = +((d.byCat[catId] || 0) / t * 100).toFixed(1)
        }
      }
      return row
    })
  }, [monthlyData, chartMode, activeCatIds, catMap])

  // Current month categories sorted by spend
  const currentCatBreakdown = useMemo(() => {
    return activeCatIds
      .map((catId) => ({
        name: catMap[catId]?.name || 'Unknown',
        color: catMap[catId]?.color || '#90A4AE',
        amount: currentMonth.byCat[catId] || 0,
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [currentMonth, activeCatIds, catMap])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const currentMonthLabel = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
  const deltaSign = delta >= 0 ? '+' : ''
  const deltaColor = delta <= 0 ? 'success.main' : 'error.main'

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        dashboard
      </Typography>

      {/* ── Stat cards ── */}
      <Stack direction="row" spacing={2} mb={4} flexWrap="wrap" useFlexGap>
        <StatCard
          label={`spent in ${currentMonthLabel}`}
          value={fmtRupeeFull(currentMonth.total)}
          sub={`${currentMonth.count} transactions`}
        />
        <StatCard
          label="vs last month"
          value={`${deltaSign}${fmtRupeeFull(Math.abs(delta))}`}
          valueColor={deltaColor}
          sub={
            prevMonth.total
              ? `${deltaSign}${((delta / prevMonth.total) * 100).toFixed(1)}%`
              : '—'
          }
        />
        {currentCatBreakdown[0] && (
          <StatCard
            label="top category this month"
            value={currentCatBreakdown[0].name}
            sub={fmtRupeeFull(currentCatBreakdown[0].amount)}
          />
        )}
        {assetsTotal != null && (
          <StatCard
            label="total assets"
            value={fmtRupeeFull(assetsTotal)}
            sub="investments + fixed deposits + loans out"
          />
        )}
      </Stack>

      {/* ── Monthly trend chart ── */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              monthly trend
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={chartMode}
              onChange={(_, v) => v && setChartMode(v)}
            >
              <ToggleButton value="total">total</ToggleButton>
              <ToggleButton value="category">by category</ToggleButton>
              <ToggleButton value="proportion">proportion</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {chartMode === 'category' ? (
            <CategoryTable
              monthlyData={monthlyData}
              activeCatIds={activeCatIds}
              catMap={catMap}
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              {chartMode === 'total' ? (
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtRupeeShort} tick={{ fontSize: 11 }} width={54} />
                  <Tooltip formatter={(v) => [fmtRupeeFull(v), 'Total']} />
                  <Area
                    type="monotone"
                    dataKey="Total"
                    stroke="#7C4DFF"
                    strokeWidth={2}
                    fill="url(#areaGrad)"
                    dot={{ r: 3, fill: '#7C4DFF' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    content={<ProportionTooltip />}
                    allowEscapeViewBox={{ x: true, y: true }}
                  />
                  {activeCatIds.map((catId) => {
                    const cat = catMap[catId]
                    return cat ? (
                      <Bar
                        key={catId}
                        dataKey={cat.name}
                        stackId="a"
                        fill={cat.color || '#90A4AE'}
                      />
                    ) : null
                  })}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

    </Box>
  )
}
