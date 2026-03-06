import { useEffect, useState, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import SendIcon from '@mui/icons-material/Send'
import { useAuth } from '../contexts/AuthContext.jsx'
import { recurringItems, categories, expenses } from '../db/index.js'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const EMPTY_FORM = {
  name: '',
  amount: '',
  isVariable: false,
  categoryId: '',
  frequency: 'monthly',
  renewalMonth: '',
  frequencyMonths: '',
  paymentMethod: '',
  notes: '',
  isActive: true,
}

function fmt(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function Recurring() {
  const { currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [inactiveOpen, setInactiveOpen] = useState(false)

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Push drawer
  const [pushOpen, setPushOpen] = useState(false)
  const [pushItems, setPushItems] = useState([])
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const [pushing, setPushing] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [itemsData, catsData] = await Promise.all([
          recurringItems.getAll(currentUser.uid),
          categories.getAll(currentUser.uid),
        ])
        setItems(itemsData)
        setCats(catsData)
      } catch (err) {
        console.error('Recurring load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser.uid])

  const catMap = useMemo(() => {
    const m = {}
    for (const c of cats) m[c.id] = c
    return m
  }, [cats])

  const monthly = useMemo(
    () => items.filter((i) => i.isActive && i.frequency === 'monthly'),
    [items]
  )
  const occasional = useMemo(
    () => items.filter((i) => i.isActive && i.frequency === 'every_n_months'),
    [items]
  )
  const yearly = useMemo(
    () => items.filter((i) => i.isActive && i.frequency === 'yearly'),
    [items]
  )
  const inactive = useMemo(() => items.filter((i) => !i.isActive), [items])

  const monthlyTotal = useMemo(
    () => monthly.filter((i) => !i.isVariable).reduce((s, i) => s + (i.amount || 0), 0),
    [monthly]
  )

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const pushKey = `recurring_push_${currentYear}-${String(currentMonth).padStart(2, '0')}`
  const monthLabel = MONTH_NAMES[currentMonth - 1]
  const dueYearly = useMemo(
    () => yearly.filter((i) => i.renewalMonth === currentMonth),
    [yearly, currentMonth]
  )

  // --- CRUD ---

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setForm({
      name: item.name || '',
      amount: item.isVariable ? '' : String(item.amount ?? ''),
      isVariable: item.isVariable ?? false,
      categoryId: item.categoryId || '',
      frequency: item.frequency || 'monthly',
      renewalMonth: item.renewalMonth ?? '',
      frequencyMonths: item.frequencyMonths ?? '',
      paymentMethod: item.paymentMethod || '',
      notes: item.notes || '',
      isActive: item.isActive ?? true,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        amount: form.isVariable ? 0 : Number(form.amount) || 0,
        isVariable: form.isVariable,
        categoryId: form.categoryId || null,
        frequency: form.frequency,
        renewalMonth:
          form.frequency === 'yearly' && form.renewalMonth ? Number(form.renewalMonth) : null,
        frequencyMonths:
          form.frequency === 'every_n_months' && form.frequencyMonths
            ? Number(form.frequencyMonths)
            : null,
        paymentMethod: form.paymentMethod.trim() || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      }
      if (editingId) {
        await recurringItems.update(editingId, data)
        setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...data } : i)))
      } else {
        const ref = await recurringItems.add(currentUser.uid, data)
        setItems((prev) => [...prev, { id: ref.id, ...data }])
      }
      setDialogOpen(false)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await recurringItems.remove(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function toggleActive(item) {
    const newActive = !item.isActive
    await recurringItems.update(item.id, { ...item, isActive: newActive })
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: newActive } : i)))
  }

  // --- Push flow ---

  async function openPush() {
    const existing = await expenses.getByImportedFrom(currentUser.uid, pushKey)
    setDuplicateWarning(existing.length > 0)
    const allDue = [...monthly, ...dueYearly]
    setPushItems([
      ...allDue.map((i) => ({
        ...i,
        pushAmount: i.isVariable ? '' : String(i.amount ?? ''),
        pushInclude: true,
      })),
      ...occasional.map((i) => ({
        ...i,
        pushAmount: i.isVariable ? '' : String(i.amount ?? ''),
        pushInclude: false,
      })),
    ])
    setPushOpen(true)
  }

  async function handlePush() {
    const included = pushItems.filter((i) => i.pushInclude)
    const hasInvalidVariable = included.some(
      (i) => i.isVariable && (!i.pushAmount || isNaN(Number(i.pushAmount)))
    )
    if (hasInvalidVariable) return

    setPushing(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const docs = included.map((item) => ({
        date: today,
        amount: Number(item.pushAmount),
        description: item.name,
        categoryId: item.categoryId || null,
        paymentMethod: item.paymentMethod || null,
        cardId: null,
        notes: null,
        importedFrom: pushKey,
      }))
      await expenses.batchAdd(currentUser.uid, docs)
      setPushOpen(false)
    } catch (err) {
      console.error('Push error:', err)
    } finally {
      setPushing(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const includedPushItems = pushItems.filter((i) => i.pushInclude)
  const canPush = !includedPushItems.some(
    (i) => i.isVariable && (!i.pushAmount || isNaN(Number(i.pushAmount)))
  )

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Recurring Items
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd}>
            Add
          </Button>
          <Button variant="contained" endIcon={<SendIcon />} onClick={openPush}>
            Push This Month
          </Button>
        </Stack>
      </Stack>

      {/* Monthly section */}
      <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={700}
            textTransform="uppercase"
            letterSpacing={0.5}
          >
            Monthly
          </Typography>
          <Chip label={`${monthly.length} items`} size="small" />
          <Typography variant="body2" color="text.secondary">
            {fmt(monthlyTotal)}/mo (fixed)
          </Typography>
        </Stack>
        {monthly.length > 0 ? (
          <ItemTable items={monthly} catMap={catMap} onEdit={openEdit} onDelete={handleDelete} onToggleActive={toggleActive} />
        ) : (
          <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
            No monthly items.
          </Typography>
        )}
      </Paper>

      {/* Occasional section */}
      {(occasional.length > 0) && (
        <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={700}
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              Occasional
            </Typography>
            <Chip label={`${occasional.length} items`} size="small" />
            <Typography variant="body2" color="text.secondary">
              every few months — include manually in push
            </Typography>
          </Stack>
          <ItemTable items={occasional} catMap={catMap} onEdit={openEdit} onDelete={handleDelete} onToggleActive={toggleActive} />
        </Paper>
      )}

      {/* Yearly section */}
      <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={700}
            textTransform="uppercase"
            letterSpacing={0.5}
          >
            Yearly
          </Typography>
          <Chip label={`${yearly.length} items`} size="small" />
        </Stack>
        {yearly.length > 0 ? (
          <ItemTable items={yearly} catMap={catMap} onEdit={openEdit} onDelete={handleDelete} onToggleActive={toggleActive} />
        ) : (
          <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
            No yearly items.
          </Typography>
        )}
      </Paper>

      {/* Inactive section (collapsible) */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', cursor: 'pointer' }}
          onClick={() => setInactiveOpen((v) => !v)}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              textTransform="uppercase"
              letterSpacing={0.5}
              color="text.secondary"
            >
              Inactive
            </Typography>
            <Chip label={`${inactive.length} items`} size="small" />
          </Stack>
          {inactiveOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Stack>
        <Collapse in={inactiveOpen}>
          {inactive.length > 0 ? (
            <ItemTable items={inactive} catMap={catMap} onEdit={openEdit} onDelete={handleDelete} onToggleActive={toggleActive} />
          ) : (
            <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
              No inactive items.
            </Typography>
          )}
        </Collapse>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Recurring Item' : 'Add Recurring Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
              autoFocus
            />
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Amount"
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                disabled={form.isVariable}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                sx={{ flex: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isVariable}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isVariable: e.target.checked, amount: '' }))
                    }
                  />
                }
                label="Variable"
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                label="Category"
              >
                <MenuItem value="">— None —</MenuItem>
                {cats.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={form.frequency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, frequency: e.target.value, renewalMonth: '', frequencyMonths: '' }))
                }
                label="Frequency"
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="every_n_months">Every N months</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
              </Select>
            </FormControl>
            {form.frequency === 'every_n_months' && (
              <TextField
                label="Every how many months?"
                type="number"
                value={form.frequencyMonths}
                onChange={(e) => setForm((f) => ({ ...f, frequencyMonths: e.target.value }))}
                fullWidth
                inputProps={{ min: 2, max: 12 }}
                placeholder="e.g. 2 for every 2 months"
              />
            )}
            {form.frequency === 'yearly' && (
              <FormControl fullWidth>
                <InputLabel>Renewal Month</InputLabel>
                <Select
                  value={form.renewalMonth}
                  onChange={(e) => setForm((f) => ({ ...f, renewalMonth: e.target.value }))}
                  label="Renewal Month"
                >
                  <MenuItem value="">— Unknown —</MenuItem>
                  {MONTH_NAMES.map((m, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label="Payment Method"
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              fullWidth
              placeholder="e.g. Web - Regalia, Manual - Amazon"
            />
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Push to Transactions Drawer */}
      <Drawer
        anchor="right"
        open={pushOpen}
        onClose={() => setPushOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, p: 3, overflowY: 'auto' } }}
      >
        <Typography variant="h6" fontWeight={700} mb={1}>
          Push to Transactions — {monthLabel} {currentYear}
        </Typography>

        {duplicateWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You already pushed recurring items for {monthLabel} {currentYear}. Pushing again will
            create duplicates.
          </Alert>
        )}

        <Typography
          variant="subtitle2"
          color="text.secondary"
          mb={1}
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          Monthly items ({monthly.length})
        </Typography>
        {pushItems
          .filter((pi) => pi.frequency === 'monthly')
          .map((pi) => (
            <PushRow
              key={pi.id}
              item={pi}
              catMap={catMap}
              onChange={(val) =>
                setPushItems((prev) => prev.map((p) => (p.id === pi.id ? { ...p, pushAmount: val } : p)))
              }
            />
          ))}

        <Divider sx={{ my: 2 }} />

        <Typography
          variant="subtitle2"
          color="text.secondary"
          mb={1}
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          Yearly items due this month ({dueYearly.length})
        </Typography>
        {dueYearly.length === 0 ? (
          <Typography variant="body2" color="text.secondary" mb={2}>
            None due in {monthLabel} {currentYear}.
          </Typography>
        ) : (
          pushItems
            .filter((pi) => pi.frequency === 'yearly')
            .map((pi) => (
              <PushRow
                key={pi.id}
                item={pi}
                catMap={catMap}
                onChange={(val) =>
                  setPushItems((prev) => prev.map((p) => (p.id === pi.id ? { ...p, pushAmount: val } : p)))
                }
              />
            ))
        )}

        {occasional.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="subtitle2"
              color="text.secondary"
              mb={0.5}
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              Occasional — include if due this month
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              These don't bill every month. Check the ones that are due.
            </Typography>
            {pushItems
              .filter((pi) => pi.frequency === 'every_n_months')
              .map((pi) => (
                <PushRow
                  key={pi.id}
                  item={pi}
                  catMap={catMap}
                  checkable
                  checked={pi.pushInclude}
                  onCheck={(val) =>
                    setPushItems((prev) =>
                      prev.map((p) => (p.id === pi.id ? { ...p, pushInclude: val } : p))
                    )
                  }
                  onChange={(val) =>
                    setPushItems((prev) =>
                      prev.map((p) => (p.id === pi.id ? { ...p, pushAmount: val } : p))
                    )
                  }
                />
              ))}
          </>
        )}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setPushOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePush}
            disabled={pushing || !canPush}
            endIcon={<SendIcon />}
          >
            {pushing ? 'Pushing…' : `Confirm & Push (${includedPushItems.length})`}
          </Button>
        </Box>
      </Drawer>
    </Box>
  )
}

function ItemTable({ items, catMap, onEdit, onDelete, onToggleActive }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Renewal</TableCell>
            <TableCell>Payment</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const cat = catMap[item.categoryId]
            return (
              <TableRow key={item.id} hover>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  {cat ? (
                    <Chip
                      label={`${cat.icon ?? ''} ${cat.name}`}
                      size="small"
                      sx={{
                        bgcolor: cat.color + '22',
                        color: 'text.primary',
                        fontSize: '0.75rem',
                      }}
                    />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {item.isVariable ? (
                    <Typography variant="body2" fontStyle="italic" color="text.secondary">
                      variable
                    </Typography>
                  ) : (
                    fmt(item.amount)
                  )}
                </TableCell>
                <TableCell>
                  {item.frequency === 'yearly' && item.renewalMonth ? (
                    <Chip label={MONTH_NAMES[item.renewalMonth - 1]} size="small" variant="outlined" />
                  ) : item.frequency === 'every_n_months' ? (
                    <Chip
                      label={item.frequencyMonths ? `every ${item.frequencyMonths} mo` : 'occasional'}
                      size="small"
                      variant="outlined"
                      color="warning"
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
                      {item.frequency === 'monthly' ? 'Monthly' : 'Yearly'}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
                    {item.paymentMethod || '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => onEdit(item)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={item.isActive ? 'Move to inactive' : 'Reactivate'}>
                    <IconButton size="small" onClick={() => onToggleActive(item)}>
                      {item.isActive ? (
                        <ArchiveOutlinedIcon fontSize="small" />
                      ) : (
                        <UnarchiveOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onDelete(item.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function PushRow({ item, catMap, onChange, checkable = false, checked = false, onCheck }) {
  const cat = catMap[item.categoryId]
  const disabled = checkable && !checked
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider', opacity: disabled ? 0.45 : 1 }}
    >
      {checkable && (
        <Checkbox
          size="small"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          sx={{ p: 0.5 }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500} noWrap>
          {item.name}
        </Typography>
        {cat && (
          <Typography variant="caption" color="text.secondary">
            {cat.icon} {cat.name}
          </Typography>
        )}
      </Box>
      {item.isVariable ? (
        <TextField
          size="small"
          type="number"
          value={item.pushAmount}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Amount"
          disabled={disabled}
          InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          sx={{ width: 140 }}
          error={!disabled && !item.pushAmount}
        />
      ) : (
        <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
          {fmt(item.amount)}
        </Typography>
      )}
    </Stack>
  )
}
