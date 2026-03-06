import { useEffect, useState, useMemo } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { useAuth } from '../contexts/AuthContext.jsx'
import { investments as investmentsDB, loans as loansDB } from '../db/index.js'

const INVESTMENT_CONFIG = {
  ppf:        { label: 'PPF',           color: '#1565C0' },
  pf:         { label: 'PF / EPF',      color: '#283593' },
  sip:        { label: 'Sidvin / SIPs', color: '#2E7D32' },
  stocks_etf: { label: 'Stocks & ETF',  color: '#E65100' },
}

const EMPTY_FD_FORM = {
  platform: '',
  amountInvested: '',
  currentValue: '',
  startDate: '',
  maturityDate: '',
  status: 'in_progress',
  notes: '',
}

const EMPTY_LOAN_FORM = {
  person: '',
  amount: '',
  dateGiven: '',
  expectedReturnDate: '',
  notes: '',
  manualBalance: false,
  currentBalance: '',
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function getRepaid(loan) {
  return (loan.repayments || []).reduce((s, r) => s + (r.amount || 0), 0)
}

function getOutstanding(loan) {
  if (loan.manualBalance) return loan.currentBalance ?? 0
  return Math.max(0, (loan.amount || 0) - getRepaid(loan))
}

function calcReturns(invested, maturity) {
  if (!invested || !maturity) return null
  return parseFloat(((maturity - invested) / invested * 100).toFixed(2))
}

export default function Assets() {
  const { currentUser } = useAuth()
  const [allInvestments, setAllInvestments] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)

  // Investment value edit
  const [editInvOpen, setEditInvOpen] = useState(false)
  const [editingInv, setEditingInv] = useState(null)
  const [newValue, setNewValue] = useState('')
  const [savingInv, setSavingInv] = useState(false)

  // FD dialog
  const [fdOpen, setFdOpen] = useState(false)
  const [editingFd, setEditingFd] = useState(null)
  const [fdForm, setFdForm] = useState(EMPTY_FD_FORM)
  const [savingFd, setSavingFd] = useState(false)

  // Loan dialog
  const [loanOpen, setLoanOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN_FORM)
  const [savingLoan, setSavingLoan] = useState(false)

  // Repayment drawer
  const [drawerLoan, setDrawerLoan] = useState(null)
  const [repayForm, setRepayForm] = useState({ date: '', amount: '', notes: '' })
  const [savingRepay, setSavingRepay] = useState(false)

  // Manual balance edit
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [balanceLoan, setBalanceLoan] = useState(null)
  const [newBalance, setNewBalance] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [invData, loanData] = await Promise.all([
          investmentsDB.getAll(currentUser.uid),
          loansDB.getAll(currentUser.uid),
        ])
        setAllInvestments(invData)
        setLoans(loanData)
      } catch (err) {
        console.error('Assets load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser.uid])

  // --- Derived data ---

  const investmentItems = useMemo(
    () => allInvestments.filter((i) => i.type !== 'fd'),
    [allInvestments]
  )

  const fdItems = useMemo(
    () =>
      allInvestments
        .filter((i) => i.type === 'fd')
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'in_progress' ? -1 : 1
          return (a.maturityDate || '').localeCompare(b.maturityDate || '')
        }),
    [allInvestments]
  )

  const investmentTotal = useMemo(
    () => investmentItems.reduce((s, i) => s + (i.currentValue || 0), 0),
    [investmentItems]
  )

  const fdTotal = useMemo(
    () => fdItems
      .filter((f) => f.status === 'in_progress')
      .reduce((s, f) => s + (f.currentValue || 0), 0),
    [fdItems]
  )

  const loansOutstanding = useMemo(
    () => loans.reduce((s, l) => s + getOutstanding(l), 0),
    [loans]
  )

  const grandTotal = investmentTotal + fdTotal + loansOutstanding

  // --- Investment update ---

  function openEditInv(item) {
    setEditingInv(item)
    setNewValue(String(item.currentValue ?? ''))
    setEditInvOpen(true)
  }

  async function handleSaveInv() {
    setSavingInv(true)
    try {
      const valueUpdatedAt = new Date().toISOString().slice(0, 10)
      await investmentsDB.update(editingInv.id, { ...editingInv, currentValue: Number(newValue), valueUpdatedAt })
      setAllInvestments((prev) =>
        prev.map((i) => (i.id === editingInv.id ? { ...i, currentValue: Number(newValue), valueUpdatedAt } : i))
      )
      setEditInvOpen(false)
    } finally {
      setSavingInv(false)
    }
  }

  // --- FD CRUD ---

  function openAddFd() {
    setEditingFd(null)
    setFdForm(EMPTY_FD_FORM)
    setFdOpen(true)
  }

  function openEditFd(fd) {
    setEditingFd(fd)
    setFdForm({
      platform: fd.platform || '',
      amountInvested: String(fd.amountInvested ?? ''),
      currentValue: String(fd.currentValue ?? ''),
      startDate: fd.startDate || '',
      maturityDate: fd.maturityDate || '',
      status: fd.status || 'in_progress',
      notes: fd.notes || '',
    })
    setFdOpen(true)
  }

  async function handleSaveFd() {
    setSavingFd(true)
    try {
      const inv = Number(fdForm.amountInvested) || 0
      const mat = Number(fdForm.currentValue) || 0
      const data = {
        name: `${fdForm.platform.trim()} FD`,
        type: 'fd',
        platform: fdForm.platform.trim(),
        amountInvested: inv,
        currentValue: mat,
        returnsPercent: calcReturns(inv, mat),
        startDate: fdForm.startDate || null,
        maturityDate: fdForm.maturityDate || null,
        status: fdForm.status,
        notes: fdForm.notes.trim() || null,
      }
      if (editingFd) {
        await investmentsDB.update(editingFd.id, data)
        setAllInvestments((prev) => prev.map((i) => (i.id === editingFd.id ? { ...i, ...data } : i)))
      } else {
        const ref = await investmentsDB.add(currentUser.uid, data)
        setAllInvestments((prev) => [...prev, { id: ref.id, ...data }])
      }
      setFdOpen(false)
    } finally {
      setSavingFd(false)
    }
  }

  async function handleDeleteFd(id) {
    await investmentsDB.remove(id)
    setAllInvestments((prev) => prev.filter((i) => i.id !== id))
  }

  // --- Loan CRUD ---

  function openAddLoan() {
    setEditingLoan(null)
    setLoanForm({ ...EMPTY_LOAN_FORM, dateGiven: new Date().toISOString().slice(0, 10) })
    setLoanOpen(true)
  }

  function openEditLoan(loan) {
    setEditingLoan(loan)
    setLoanForm({
      person: loan.person || '',
      amount: String(loan.amount ?? ''),
      dateGiven: loan.dateGiven || '',
      expectedReturnDate: loan.expectedReturnDate || '',
      notes: loan.notes || '',
      manualBalance: loan.manualBalance ?? false,
      currentBalance: String(loan.currentBalance ?? ''),
    })
    setLoanOpen(true)
  }

  function openBalanceEdit(loan) {
    setBalanceLoan(loan)
    setNewBalance(String(loan.currentBalance ?? ''))
    setBalanceOpen(true)
  }

  async function handleSaveBalance() {
    setSavingBalance(true)
    try {
      await loansDB.update(balanceLoan.id, { ...balanceLoan, currentBalance: Number(newBalance) })
      setLoans((prev) =>
        prev.map((l) => (l.id === balanceLoan.id ? { ...l, currentBalance: Number(newBalance) } : l))
      )
      setBalanceOpen(false)
    } finally {
      setSavingBalance(false)
    }
  }

  async function handleSaveLoan() {
    setSavingLoan(true)
    try {
      const data = {
        person: loanForm.person.trim(),
        amount: Number(loanForm.amount) || 0,
        dateGiven: loanForm.dateGiven || null,
        expectedReturnDate: loanForm.expectedReturnDate || null,
        notes: loanForm.notes.trim() || null,
        repayments: editingLoan?.repayments || [],
        manualBalance: loanForm.manualBalance,
        currentBalance: loanForm.manualBalance ? (Number(loanForm.currentBalance) || 0) : null,
      }
      if (editingLoan) {
        await loansDB.update(editingLoan.id, data)
        setLoans((prev) => prev.map((l) => (l.id === editingLoan.id ? { ...l, ...data } : l)))
      } else {
        const ref = await loansDB.add(currentUser.uid, data)
        setLoans((prev) => [...prev, { id: ref.id, ...data }])
      }
      setLoanOpen(false)
    } finally {
      setSavingLoan(false)
    }
  }

  async function handleDeleteLoan(id) {
    await loansDB.remove(id)
    setLoans((prev) => prev.filter((l) => l.id !== id))
  }

  // --- Repayments ---

  function openDrawer(loan) {
    setDrawerLoan(loan)
    setRepayForm({ date: new Date().toISOString().slice(0, 10), amount: '', notes: '' })
  }

  async function handleLogRepayment() {
    if (!repayForm.amount || !drawerLoan) return
    setSavingRepay(true)
    try {
      const entry = {
        id: Date.now().toString(),
        date: repayForm.date,
        amount: Number(repayForm.amount),
        notes: repayForm.notes.trim() || null,
      }
      const updated = [...(drawerLoan.repayments || []), entry]
      await loansDB.updateRepayments(drawerLoan.id, updated)
      const updatedLoan = { ...drawerLoan, repayments: updated }
      setLoans((prev) => prev.map((l) => (l.id === drawerLoan.id ? updatedLoan : l)))
      setDrawerLoan(updatedLoan)
      setRepayForm({ date: new Date().toISOString().slice(0, 10), amount: '', notes: '' })
    } finally {
      setSavingRepay(false)
    }
  }

  async function handleDeleteRepayment(repayId) {
    const updated = (drawerLoan.repayments || []).filter((r) => r.id !== repayId)
    await loansDB.updateRepayments(drawerLoan.id, updated)
    const updatedLoan = { ...drawerLoan, repayments: updated }
    setLoans((prev) => prev.map((l) => (l.id === drawerLoan.id ? updatedLoan : l)))
    setDrawerLoan(updatedLoan)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Typography variant="h6" fontWeight={700} mb={0.5}>
        assets
      </Typography>
      <Typography variant="h4" fontWeight={800} color="primary.main" mb={3}>
        {fmt(grandTotal)}
      </Typography>

      {/* Summary cards — double as tab selectors */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" useFlexGap>
        <SummaryCard label="investments" value={investmentTotal} active={tab === 0} onClick={() => setTab(0)} />
        <SummaryCard label="fixed deposits" value={fdTotal} sublabel="maturity · active only" active={tab === 1} onClick={() => setTab(1)} />
        <SummaryCard label="loans out" value={loansOutstanding} sublabel="outstanding" active={tab === 2} onClick={() => setTab(2)} />
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="investments" />
        <Tab label="fixed deposits" />
        <Tab label="loans" />
      </Tabs>

      {/* ── Tab 0: Investments ── */}
      {tab === 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {investmentItems.length === 0 && (
            <Typography color="text.secondary">No investments yet. Run import_assets.py to seed.</Typography>
          )}
          {investmentItems.map((item) => {
            const cfg = INVESTMENT_CONFIG[item.type] || { label: item.name, color: '#6750A4' }
            return (
              <Paper
                key={item.id}
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderLeft: `4px solid ${cfg.color}`,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => openEditInv(item)}
              >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
                      {cfg.label}
                    </Typography>
                    <Typography variant="h5" fontWeight={700} mt={0.5} sx={{ color: cfg.color }}>
                      {fmt(item.currentValue)}
                    </Typography>
                    {item.valueUpdatedAt ? (
                      <Typography variant="caption" color="text.secondary">
                        Updated {new Date(item.valueUpdatedAt + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </Typography>
                    ) : item.notes ? (
                      <Typography variant="caption" color="text.secondary">{item.notes}</Typography>
                    ) : null}
                  </Box>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditInv(item) }}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Paper>
            )
          })}
        </Box>
      )}

      {/* ── Tab 1: Fixed Deposits ── */}
      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddFd}>add fixed deposit</Button>
          </Stack>
          {fdItems.length === 0 ? (
            <Typography color="text.secondary">No FDs yet.</Typography>
          ) : (
            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                    <TableCell>where</TableCell>
                    <TableCell align="right">invested</TableCell>
                    <TableCell align="right">i get back</TableCell>
                    <TableCell align="right">return</TableCell>
                    <TableCell>matures on</TableCell>
                    <TableCell>status</TableCell>
                    <TableCell padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fdItems.map((fd) => {
                    const active = fd.status === 'in_progress'
                    return (
                      <TableRow key={fd.id} sx={{ opacity: active ? 1 : 0.5, '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell sx={{ fontWeight: 500 }}>
                          <Stack direction="row" alignItems="center" spacing={0.75} component="span" sx={{ display: 'inline-flex' }}>
                            <span>{fd.platform || fd.name}</span>
                            {fd.notes && (
                              <Tooltip title={fd.notes} arrow>
                                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0, cursor: 'help', display: 'inline-block' }} />
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{fmt(fd.amountInvested)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(fd.currentValue)}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontSize: '0.8rem' }}>
                          {fd.returnsPercent != null ? `+${fd.returnsPercent}%` : '—'}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{fd.maturityDate || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={active ? 'Active' : 'Matured'}
                            size="small"
                            color={active ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell padding="checkbox">
                          <Stack direction="row">
                            <IconButton size="small" onClick={() => openEditFd(fd)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteFd(fd.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ── Tab 2: Loans ── */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openAddLoan}>add loan</Button>
          </Stack>
          {loans.length === 0 ? (
            <Typography color="text.secondary">No loans yet.</Typography>
          ) : (
            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                    <TableCell>name</TableCell>
                    <TableCell align="right">loaned</TableCell>
                    <TableCell align="right">repaid</TableCell>
                    <TableCell align="right">outstanding</TableCell>
                    <TableCell padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loans.map((loan) => {
                    const repaid = getRepaid(loan)
                    const outstanding = getOutstanding(loan)
                    const settled = outstanding === 0
                    return (
                      <TableRow
                        key={loan.id}
                        hover
                        sx={{ cursor: 'pointer', opacity: settled ? 0.5 : 1, '&:last-child td': { borderBottom: 0 } }}
                        onClick={() => loan.manualBalance ? openBalanceEdit(loan) : openDrawer(loan)}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <span>{loan.person}</span>
                            {loan.manualBalance && (
                              <Tooltip title="Balance updated manually">
                                <Chip label="manual" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{loan.manualBalance ? '—' : fmt(loan.amount)}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>{loan.manualBalance ? '—' : fmt(repaid)}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color={settled ? 'text.secondary' : 'error.main'}>
                            {settled ? 'Settled' : fmt(outstanding)}
                          </Typography>
                        </TableCell>
                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row">
                            <IconButton size="small" onClick={() => openEditLoan(loan)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteLoan(loan.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ══ Dialogs & Drawers ══ */}

      {/* Investment value edit */}
      <Dialog open={editInvOpen} onClose={() => setEditInvOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          update {editingInv ? (INVESTMENT_CONFIG[editingInv.type]?.label || editingInv.name) : ''}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Current Value"
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditInvOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveInv} disabled={savingInv || !newValue}>
            {savingInv ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FD dialog */}
      <Dialog open={fdOpen} onClose={() => setFdOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFd ? 'edit fixed deposit' : 'add fixed deposit'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Bank / Institution"
              value={fdForm.platform}
              onChange={(e) => setFdForm((f) => ({ ...f, platform: e.target.value }))}
              fullWidth required autoFocus
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Invested"
                type="number"
                value={fdForm.amountInvested}
                onChange={(e) => setFdForm((f) => ({ ...f, amountInvested: e.target.value }))}
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
              <TextField
                label="Maturity Amount"
                type="number"
                value={fdForm.currentValue}
                onChange={(e) => setFdForm((f) => ({ ...f, currentValue: e.target.value }))}
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start Date"
                type="date"
                value={fdForm.startDate}
                onChange={(e) => setFdForm((f) => ({ ...f, startDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Maturity Date"
                type="date"
                value={fdForm.maturityDate}
                onChange={(e) => setFdForm((f) => ({ ...f, maturityDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              {[['in_progress', 'Active'], ['matured', 'Matured']].map(([val, lbl]) => (
                <Chip
                  key={val}
                  label={lbl}
                  onClick={() => setFdForm((f) => ({ ...f, status: val }))}
                  color={fdForm.status === val ? (val === 'in_progress' ? 'success' : 'default') : 'default'}
                  variant={fdForm.status === val ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
            <TextField
              label="Notes"
              value={fdForm.notes}
              onChange={(e) => setFdForm((f) => ({ ...f, notes: e.target.value }))}
              fullWidth multiline rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFdOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFd} disabled={savingFd || !fdForm.platform}>
            {savingFd ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loan dialog */}
      <Dialog open={loanOpen} onClose={() => setLoanOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLoan ? 'edit loan' : 'add loan'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              value={loanForm.person}
              onChange={(e) => setLoanForm((f) => ({ ...f, person: e.target.value }))}
              fullWidth required autoFocus
            />
            <TextField
              label="Total Amount Loaned"
              type="number"
              value={loanForm.amount}
              onChange={(e) => setLoanForm((f) => ({ ...f, amount: e.target.value }))}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Date Given"
                type="date"
                value={loanForm.dateGiven}
                onChange={(e) => setLoanForm((f) => ({ ...f, dateGiven: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Expected Return"
                type="date"
                value={loanForm.expectedReturnDate}
                onChange={(e) => setLoanForm((f) => ({ ...f, expectedReturnDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <TextField
              label="Notes"
              value={loanForm.notes}
              onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))}
              fullWidth multiline rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={loanForm.manualBalance}
                  onChange={(e) => setLoanForm((f) => ({ ...f, manualBalance: e.target.checked }))}
                />
              }
              label="Manual balance (no repayment log)"
            />
            {loanForm.manualBalance && (
              <TextField
                label="Current outstanding balance"
                type="number"
                value={loanForm.currentBalance}
                onChange={(e) => setLoanForm((f) => ({ ...f, currentBalance: e.target.value }))}
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoanOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveLoan}
            disabled={savingLoan || !loanForm.person || !loanForm.amount}
          >
            {savingLoan ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual balance edit dialog */}
      <Dialog open={balanceOpen} onClose={() => setBalanceOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>update balance — {balanceLoan?.person}</DialogTitle>
        <DialogContent>
          <TextField
            label="Current outstanding balance"
            type="number"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            helperText="Check the Google Sheet and enter the latest outstanding amount"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBalanceOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveBalance} disabled={savingBalance || newBalance === ''}>
            {savingBalance ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Repayment drawer */}
      <Drawer
        anchor="right"
        open={!!drawerLoan}
        onClose={() => setDrawerLoan(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 3, overflowY: 'auto' } }}
      >
        {drawerLoan && <RepaymentContent
          loan={drawerLoan}
          repayForm={repayForm}
          onRepayFormChange={setRepayForm}
          onLog={handleLogRepayment}
          onDelete={handleDeleteRepayment}
          saving={savingRepay}
        />}
      </Drawer>
    </Box>
  )
}

function SummaryCard({ label, value, sublabel, active, onClick }) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        px: 2.5, py: 2, flex: 1, minWidth: 160, cursor: 'pointer',
        borderColor: active ? 'primary.main' : 'divider',
        borderWidth: active ? 2 : 1,
        '&:hover': { borderColor: 'primary.light' },
      }}
    >
      <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} mt={0.5}>{fmt(value)}</Typography>
      {sublabel && <Typography variant="caption" color="text.secondary">{sublabel}</Typography>}
    </Paper>
  )
}

function RepaymentContent({ loan, repayForm, onRepayFormChange, onLog, onDelete, saving }) {
  const repaid = getRepaid(loan)
  const outstanding = Math.max(0, (loan.amount || 0) - repaid)
  const settled = outstanding === 0

  const sorted = [...(loan.repayments || [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <Typography variant="h6" fontWeight={700}>{loan.person}</Typography>
      <Stack direction="row" spacing={3} mt={1} mb={2}>
        <Box>
          <Typography variant="caption" color="text.secondary">loaned</Typography>
          <Typography fontWeight={600}>{fmt(loan.amount)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">repaid</Typography>
          <Typography fontWeight={600} color="success.main">{fmt(repaid)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">outstanding</Typography>
          <Typography fontWeight={700} color={settled ? 'text.secondary' : 'error.main'}>
            {settled ? 'Settled' : fmt(outstanding)}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" textTransform="uppercase" letterSpacing={0.5} mb={1}>
        repayment log
      </Typography>

      {sorted.length === 0 ? (
        <Typography variant="body2" color="text.secondary" mb={2}>No repayments logged yet.</Typography>
      ) : (
        <List dense disablePadding sx={{ mb: 2 }}>
          {sorted.map((r) => (
            <ListItem
              key={r.id}
              disablePadding
              sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 0.5 }}
              secondaryAction={
                <IconButton size="small" color="error" onClick={() => onDelete(r.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={fmt(r.amount)}
                secondary={`${r.date}${r.notes ? ` · ${r.notes}` : ''}`}
                primaryTypographyProps={{ fontWeight: 600 }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" textTransform="uppercase" letterSpacing={0.5} mb={1.5}>
        log repayment
      </Typography>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1}>
          <TextField
            label="Date"
            type="date"
            size="small"
            value={repayForm.date}
            onChange={(e) => onRepayFormChange((f) => ({ ...f, date: e.target.value }))}
            sx={{ flex: 1 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Amount"
            type="number"
            size="small"
            value={repayForm.amount}
            onChange={(e) => onRepayFormChange((f) => ({ ...f, amount: e.target.value }))}
            sx={{ flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          />
        </Stack>
        <TextField
          label="Notes (optional)"
          size="small"
          value={repayForm.notes}
          onChange={(e) => onRepayFormChange((f) => ({ ...f, notes: e.target.value }))}
          fullWidth
        />
        <Button
          variant="contained"
          onClick={onLog}
          disabled={saving || !repayForm.amount || !repayForm.date}
          fullWidth
        >
          {saving ? 'Logging…' : 'Log Repayment'}
        </Button>
      </Stack>
    </>
  )
}
