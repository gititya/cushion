import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { budgets, categories, expenses } from '../../db/index.js'
import { budgetProgress } from '../../analytics.js'

const EMPTY_FORM = {
  categoryId: '',
  monthlyLimit: '',
  alertAt80: true,
  alertAt100: true,
  isActive: true,
}

export default function BudgetSettings() {
  const { currentUser } = useAuth()
  const [budgetList, setBudgetList] = useState([])
  const [catList, setCatList] = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [bdgs, cats, exps] = await Promise.all([
        budgets.getAll(currentUser.uid),
        categories.getAll(currentUser.uid),
        expenses.getAll(currentUser.uid),
      ])
      setBudgetList(bdgs)
      setCatList(cats)
      setAllExpenses(exps)
    } catch (err) {
      console.error('Budgets load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Compute progress reactively from current budgetList + expenses
  const progress = budgetProgress(budgetList, allExpenses, currentYear, currentMonth)
  const progressMap = Object.fromEntries(progress.map((p) => [p.id, p]))
  const catMap = Object.fromEntries(catList.map((c) => [c.id, c]))

  // Only show active categories not already budgeted (except the one being edited)
  const usedCategoryIds = new Set(budgetList.map((b) => b.categoryId))
  const availableCats = catList.filter(
    (c) => c.isActive && (!usedCategoryIds.has(c.id) || (editing && editing.categoryId === c.id))
  )

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(budget) {
    setEditing(budget)
    setForm({
      categoryId: budget.categoryId,
      monthlyLimit: String(budget.monthlyLimit),
      alertAt80: budget.alertAt80 ?? true,
      alertAt100: budget.alertAt100 ?? true,
      isActive: budget.isActive ?? true,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const data = {
      categoryId: form.categoryId,
      monthlyLimit: parseFloat(form.monthlyLimit),
      alertAt80: form.alertAt80,
      alertAt100: form.alertAt100,
      isActive: form.isActive,
    }
    if (editing) {
      await budgets.update(editing.id, data)
      setBudgetList((prev) => prev.map((b) => (b.id === editing.id ? { ...b, ...data } : b)))
    } else {
      const ref = await budgets.add(currentUser.uid, data)
      setBudgetList((prev) => [...prev, { id: ref.id, ...data }])
    }
    setSaving(false)
    setDialogOpen(false)
  }

  async function handleDelete(id) {
    await budgets.remove(id)
    setBudgetList((prev) => prev.filter((b) => b.id !== id))
  }

  function progressColor(pct) {
    if (pct >= 100) return 'error'
    if (pct >= 80) return 'warning'
    return 'success'
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h6" fontWeight={700}>
          budgets
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add
        </Button>
      </Stack>

      {budgetList.length === 0 ? (
        <Typography color="text.secondary">No budgets yet.</Typography>
      ) : (
        <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          {budgetList.map((budget, idx) => {
            const cat = catMap[budget.categoryId]
            const prog = progressMap[budget.id]
            const spent = prog?.spent ?? 0
            const pct = prog?.percentUsed ?? 0
            return (
              <Box key={budget.id}>
                {idx > 0 && <Divider />}
                <Stack sx={{ px: 2, py: 1.5 }} spacing={0.75}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: cat?.color ?? '#6750A4',
                        flexShrink: 0,
                      }}
                    />
                    <Typography sx={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>
                      {cat?.icon}
                    </Typography>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {cat?.name ?? budget.categoryId}
                    </Typography>
                    {!budget.isActive && (
                      <Typography variant="caption" color="text.disabled">
                        inactive
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      ₹{spent.toLocaleString('en-IN', { maximumFractionDigits: 0 })} /{' '}
                      ₹{budget.monthlyLimit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Typography>
                    <IconButton size="small" onClick={() => openEdit(budget)} aria-label="edit">
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(budget.id)}
                      aria-label="delete"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={budget.isActive ? Math.min(pct, 100) : 0}
                    color={budget.isActive ? progressColor(pct) : 'inherit'}
                    sx={{ height: 6, borderRadius: 3, ml: 4 }}
                  />
                </Stack>
              </Box>
            )
          })}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'edit budget' : 'new budget'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              label="Category"
              name="categoryId"
              value={form.categoryId}
              onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              required
              fullWidth
            >
              {availableCats.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Monthly limit (₹)"
              name="monthlyLimit"
              type="number"
              inputProps={{ min: 0, step: '1' }}
              value={form.monthlyLimit}
              onChange={(e) => setForm((prev) => ({ ...prev, monthlyLimit: e.target.value }))}
              required
              fullWidth
            />
            <Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.alertAt80}
                    onChange={(e) => setForm((prev) => ({ ...prev, alertAt80: e.target.checked }))}
                  />
                }
                label={<Typography variant="body2">Alert at 80%</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.alertAt100}
                    onChange={(e) => setForm((prev) => ({ ...prev, alertAt100: e.target.checked }))}
                  />
                }
                label={<Typography variant="body2">Alert at 100%</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label={<Typography variant="body2">Active</Typography>}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.categoryId || !form.monthlyLimit || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
