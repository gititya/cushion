import { useEffect, useState, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogContent,
  LinearProgress,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip as MuiTooltip,
  IconButton,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
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
import { expenses, categories, investments as investmentsDB, loans as loansDB, budgets as budgetsDB, trendNotes as trendNotesDB, creditCards as creditCardsDB } from '../db/index.js'
import { askFinancialQuestion } from '../claude.js'

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

function fmtMonthLong(ym) {
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
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

function CategoryTable({ monthlyData, activeCatIds, catMap, budgetMap, noteMap, onCellClick, selectedMonthYm }) {
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

  // Budget strip data — selected month spend per category
  // Show: any category with selected month spend, plus any category with a budget set
  const stripItems = useMemo(() => {
    const current = monthlyData.find((d) => d.ym === selectedMonthYm)
    if (!current) return []
    return rows
      .map(({ catId, cat }) => {
        const spent = current.byCat[catId] || 0
        const limit = budgetMap[catId]
        const hasBudget = !!limit && limit > 0
        const pct = hasBudget ? (spent / limit) * 100 : 0
        return { catId, cat, spent, pct, hasBudget }
      })
      .filter((r) => r.spent > 0 || r.hasBudget)
  }, [rows, monthlyData, budgetMap])

  return (
    <>
      {/* Budget health strip */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ pb: 1 }}>
          {stripItems.map(({ catId, cat, spent, pct, hasBudget }) => (
            <Box
              key={catId}
              sx={{
                minWidth: 120,
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {cat.icon} {cat.name}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {fmtRupeeFull(spent)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={hasBudget ? Math.min(pct, 100) : 100}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  mt: 0.75,
                  mb: 0.5,
                  bgcolor: 'grey.200',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: !hasBudget
                      ? 'grey.400'
                      : pct >= 100
                      ? 'error.main'
                      : pct >= 80
                      ? '#ff8f00'
                      : 'success.main',
                  },
                }}
              />
              <Typography variant="caption" color={hasBudget ? 'text.secondary' : 'text.disabled'}>
                {hasBudget ? `${Math.round(pct)}% of budget` : 'no budget'}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      <TableContainer sx={{ overflow: 'auto' }}>
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
                  sx={{
                    fontWeight: d.ym === selectedMonthYm ? 700 : 600,
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                    color: d.ym === selectedMonthYm ? '#6750A4' : 'inherit',
                  }}
                >
                  {fmtMonthLabel(d.ym)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ catId, cat }) => (
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
                  const limit = budgetMap[catId]
                  const hasBudget = !!limit && limit > 0
                  const pct = hasBudget ? (amt / limit) * 100 : 0
                  const noteKey = `${catId}_${d.ym}`
                  const hasNote = !!noteMap[noteKey]

                  let cellBg = 'transparent'
                  if (hasBudget && amt > 0) {
                    if (pct >= 100) cellBg = 'rgba(211,47,47,0.12)'
                    else if (pct >= 80) cellBg = 'rgba(255,143,0,0.15)'
                    else cellBg = 'rgba(46,125,50,0.10)'
                  }

                  const budgetStr = hasBudget && amt > 0
                    ? `${fmtRupeeFull(amt)} of ${fmtRupeeFull(limit)} (${Math.round(pct)}%)`
                    : null
                  const noteStr = hasNote ? noteMap[noteKey].note : null
                  const tooltipTitle = budgetStr || noteStr
                    ? <>{budgetStr && <div>{budgetStr}</div>}{noteStr && <div style={{ fontStyle: 'italic', marginTop: budgetStr ? 4 : 0 }}>{noteStr}</div>}</>
                    : ''

                  return (
                    <TableCell
                      key={d.ym}
                      align="right"
                      onClick={(e) => onCellClick(e, catId, d.ym)}
                      sx={{
                        fontSize: 11,
                        bgcolor: cellBg,
                        color: amt > 0 ? 'text.primary' : 'text.disabled',
                        cursor: 'pointer',
                        position: 'relative',
                        '&:hover': { boxShadow: 'inset 0 0 0 1px rgba(103,80,164,0.35)' },
                      }}
                    >
                      <MuiTooltip title={tooltipTitle} placement="top">
                        <span>{amt > 0 ? fmtRupeeShort(amt) : '—'}</span>
                      </MuiTooltip>
                      {hasNote && (
                        <Box sx={{
                          position: 'absolute', top: 3, right: 3,
                          width: 5, height: 5, borderRadius: '50%',
                          bgcolor: '#6750A4', pointerEvents: 'none',
                        }} />
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
          <TableBody>
            <TableRow sx={{ '& td': { borderTop: '2px solid', borderColor: 'divider' } }}>
              <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700, fontSize: 12 }}>
                Total
              </TableCell>
              {monthlyData.map((d) => (
                <TableCell key={d.ym} align="right"
                  sx={{ fontWeight: 700, fontSize: 11, color: d.ym === selectedMonthYm ? '#6750A4' : 'inherit' }}>
                  {d.total > 0 ? fmtRupeeShort(d.total) : '—'}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        <Box component="span" sx={{ color: 'success.main' }}>●</Box> under budget
        {' · '}
        <Box component="span" sx={{ color: '#ff8f00' }}>●</Box> near limit (80%+)
        {' · '}
        <Box component="span" sx={{ color: 'error.main' }}>●</Box> over budget
        {' · '}
        click any cell to add a note
      </Typography>
    </>
  )
}

const CARD_GRADIENTS = {
  default: {
    background: 'linear-gradient(140deg, #f0ecff 0%, #ebe5ff 60%, #e4dafa 100%)',
    label: '#79747e',
    value: '#1c1b1f',
    sub: '#79747e',
  },
  up: {
    background: 'linear-gradient(140deg, #fff8ed 0%, #feefd4 60%, #fde3b8 100%)',
    label: '#7c5800',
    value: '#4a3500',
    sub: '#7c5800',
  },
  down: {
    background: 'linear-gradient(140deg, #e8faf2 0%, #d6f5e5 60%, #c5eed8 100%)',
    label: '#1a5c38',
    value: '#0d3320',
    sub: '#1a5c38',
  },
}

function StatCard({ label, value, sub, variant = 'default' }) {
  const g = CARD_GRADIENTS[variant] || CARD_GRADIENTS.default
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 180,
        borderRadius: '20px',
        p: '22px',
        background: g.background,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(103,80,164,0.08), 0 8px 24px rgba(103,80,164,0.07)',
      }}
    >
      <Typography variant="caption" display="block" mb={0.5} sx={{ color: g.label }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} sx={{ color: g.value }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: g.sub }}>
          {sub}
        </Typography>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const EXCLUDE_TOP_CAT = new Set(['investment', 'house rent'])

export default function Dashboard() {
  const { currentUser } = useAuth()
  const [expenseList, setExpenseList] = useState([])
  const [categoryList, setCategoryList] = useState([])
  const [assetsTotal, setAssetsTotal] = useState(null)
  const [budgetList, setBudgetList] = useState([])
  const [noteMap, setNoteMap] = useState({})
  const [noteAnchor, setNoteAnchor] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState('category')
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(12)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCards, setAiCards] = useState([])
  const [aiCardsFetched, setAiCardsFetched] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [exps, cats, invs, lns, bdgs, nts] = await Promise.all([
          expenses.getAll(currentUser.uid),
          categories.getAll(currentUser.uid),
          investmentsDB.getAll(currentUser.uid),
          loansDB.getAll(currentUser.uid),
          budgetsDB.getAll(currentUser.uid),
          trendNotesDB.getAll(currentUser.uid).catch(() => []),
        ])
        setExpenseList(exps)
        setCategoryList(cats)
        setBudgetList(bdgs)
        const nm = {}
        for (const n of nts) nm[`${n.categoryId}_${n.month}`] = n
        setNoteMap(nm)

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

  const budgetMap = useMemo(
    () => Object.fromEntries(budgetList.filter((b) => b.isActive).map((b) => [b.categoryId, b.monthlyLimit])),
    [budgetList]
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

  const selectedMonthData = monthlyData[selectedMonthIdx]
  const prevMonthData = monthlyData[selectedMonthIdx - 1]
  const delta = prevMonthData ? selectedMonthData.total - prevMonthData.total : 0

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

  // Selected month categories sorted by spend
  const currentCatBreakdown = useMemo(() => {
    return activeCatIds
      .map((catId) => ({
        name: catMap[catId]?.name || 'Unknown',
        color: catMap[catId]?.color || '#90A4AE',
        amount: selectedMonthData.byCat[catId] || 0,
      }))
      .filter((x) => x.amount > 0 && !EXCLUDE_TOP_CAT.has(x.name.toLowerCase()))
      .sort((a, b) => b.amount - a.amount)
  }, [selectedMonthData, activeCatIds, catMap])

  function handleCellClick(e, catId, ym) {
    setNoteAnchor(e.currentTarget)
    setNoteTarget({ catId, ym })
    setNoteText(noteMap[`${catId}_${ym}`]?.note || '')
  }
  function handleNoteClose() { setNoteAnchor(null); setNoteTarget(null); setNoteText('') }
  function handleNoteSave() {
    if (!noteTarget || !noteText.trim()) return
    const { catId, ym } = noteTarget
    const key = `${catId}_${ym}`
    setNoteMap((prev) => ({ ...prev, [key]: { id: key, categoryId: catId, month: ym, note: noteText.trim() } }))
    handleNoteClose()
    trendNotesDB.set(currentUser.uid, catId, ym, noteText.trim()).catch(console.error)
  }
  function handleNoteDelete() {
    if (!noteTarget) return
    const { catId, ym } = noteTarget
    const key = `${catId}_${ym}`
    setNoteMap((prev) => { const n = { ...prev }; delete n[key]; return n })
    handleNoteClose()
    trendNotesDB.remove(key).catch(console.error)
  }

  async function handleAiOpen() {
    setAiOpen(true)
    setAiResponse('')
    setAiQuery('')
    if (!aiCardsFetched) {
      try {
        const cards = await creditCardsDB.getAll(currentUser.uid)
        setAiCards(cards)
        setAiCardsFetched(true)
      } catch (err) {
        console.error('AI: failed to load cards', err)
      }
    }
  }

  function handleAiClose() {
    setAiOpen(false)
    setAiQuery('')
    setAiResponse('')
  }

  async function handleAiSubmit() {
    if (!aiQuery.trim() || aiLoading) return
    setAiLoading(true)
    setAiResponse('')
    try {
      const answer = await askFinancialQuestion(aiQuery.trim(), {
        monthlyData,
        months,
        categories: categoryList,
        cards: aiCards,
        budgets: budgetList,
      })
      setAiResponse(answer)
    } catch (err) {
      console.error('AI question error:', err)
      setAiResponse('Sorry, something went wrong. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const deltaSign = delta >= 0 ? '+' : ''

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h6" fontWeight={700}>dashboard</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <MuiTooltip title="ask AI">
            <IconButton size="small" onClick={handleAiOpen}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <AutoAwesomeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </MuiTooltip>
          <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton size="small" disabled={selectedMonthIdx === 0}
            onClick={() => setSelectedMonthIdx(i => i - 1)}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>‹</IconButton>
          <Typography variant="body2" sx={{ width: 124, textAlign: 'center', fontWeight: 500 }}>
            {fmtMonthLong(selectedMonthData.ym)}
          </Typography>
          <IconButton size="small" disabled={selectedMonthIdx === months.length - 1}
            onClick={() => setSelectedMonthIdx(i => i + 1)}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>›</IconButton>
          </Stack>
        </Stack>
      </Stack>

      {/* ── Stat cards ── */}
      <Stack direction="row" spacing={2} mb={4} flexWrap="wrap" useFlexGap>
        <StatCard
          label={`spent in ${fmtMonthLong(selectedMonthData.ym)}`}
          value={fmtRupeeFull(selectedMonthData.total)}
          sub={`${selectedMonthData.count} transactions`}
        />
        <StatCard
          label="vs last month"
          value={`${deltaSign}${fmtRupeeFull(Math.abs(delta))}`}
          variant={prevMonthData ? (delta > 0 ? 'up' : 'down') : 'default'}
          sub={
            prevMonthData?.total
              ? `${deltaSign}${((delta / prevMonthData.total) * 100).toFixed(1)}%`
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
              budgetMap={budgetMap}
              noteMap={noteMap}
              onCellClick={handleCellClick}
              selectedMonthYm={selectedMonthData.ym}
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

      <Popover
        open={Boolean(noteAnchor)}
        anchorEl={noteAnchor}
        onClose={handleNoteClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          {noteTarget && (
            <Typography variant="caption" color="text.secondary" display="block" mb={1} fontWeight={600}>
              {catMap[noteTarget.catId]?.name} · {fmtMonthLabel(noteTarget.ym)}
            </Typography>
          )}
          <TextField
            multiline rows={3} fullWidth size="small"
            placeholder="Add a note for this month…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <Stack direction="row" spacing={1} mt={1.5} justifyContent="flex-end">
            {noteTarget && noteMap[`${noteTarget.catId}_${noteTarget.ym}`] && (
              <Button size="small" color="error" onClick={handleNoteDelete}>Delete</Button>
            )}
            <Button size="small" onClick={handleNoteClose}>Cancel</Button>
            <Button size="small" variant="contained" onClick={handleNoteSave} disabled={!noteText.trim()}>Save</Button>
          </Stack>
        </Box>
      </Popover>

      <Dialog open={aiOpen} onClose={handleAiClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ pt: 2.5 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="ask anything…"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAiSubmit()
              }
            }}
            InputProps={{
              endAdornment: aiLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null,
            }}
          />
          {aiResponse && (
            <Box sx={{ mt: 2, maxHeight: 200, overflowY: 'auto' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{aiResponse}</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

    </Box>
  )
}
