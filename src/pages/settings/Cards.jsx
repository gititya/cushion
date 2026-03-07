import { useEffect, useState } from 'react'
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
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { creditCards, categories } from '../../db/index.js'

const NETWORKS = ['Visa', 'Mastercard', 'Amex', 'Rupay']
const EMPTY_FORM = { name: '', network: 'Visa', billingCycle: '', isActive: true }

function daysUntilCut(billingCycle) {
  if (!billingCycle) return null
  const match = billingCycle.match(/(\d+)/)
  if (!match) return null
  const cutDay = parseInt(match[1], 10)
  const today = new Date()
  const cut = new Date(today.getFullYear(), today.getMonth(), cutDay)
  if (cut <= today) cut.setMonth(cut.getMonth() + 1)
  return Math.round((cut - today) / (1000 * 60 * 60 * 24))
}

// Match a card to categories whose cardAdvice mentions it.
// Uses specific keywords to avoid false matches (e.g. "axis" matching both Atlas and Indian Oil).
function cardKeyword(cardName) {
  const n = cardName.toLowerCase()
  if (n.includes('indian oil')) return 'indian oil'
  if (n.includes('atlas'))      return 'atlas'
  if (n.includes('swiggy'))     return 'swiggy'
  if (n.includes('amazon'))     return 'amazon'
  if (n.includes('tata neu'))   return 'tata neu'
  if (n.includes('regalia'))    return 'regalia'
  if (n.includes('amex'))       return 'amex'
  return n
}

export default function Cards() {
  const { currentUser } = useAuth()
  const [list, setList] = useState([])
  const [categoryList, setCategoryList] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [cards, cats] = await Promise.all([
        creditCards.getAll(currentUser.uid),
        categories.getAll(currentUser.uid),
      ])
      setList(cards)
      setCategoryList(cats)
    } catch (err) {
      console.error('Cards load error:', err)
    } finally {
      setLoading(false)
    }
  }

  function getCategoriesForCard(card) {
    const keyword = cardKeyword(card.name)
    return categoryList.filter(
      (cat) => cat.cardAdvice && cat.cardAdvice.toLowerCase().includes(keyword)
    )
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(card) {
    setEditing(card)
    setForm({
      name: card.name,
      network: card.network,
      billingCycle: card.billingCycle ?? '',
      isActive: card.isActive,
    })
    setDialogOpen(true)
  }

  function handleChange(e) {
    const { name, value, checked, type } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSave() {
    setSaving(true)
    const data = {
      name: form.name,
      network: form.network,
      billingCycle: form.billingCycle || null,
      isActive: form.isActive,
    }
    if (editing) {
      await creditCards.update(editing.id, data)
      setList((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...data } : c)))
    } else {
      const ref = await creditCards.add(currentUser.uid, data)
      setList((prev) => [...prev, { id: ref.id, ...data }])
    }
    setSaving(false)
    setDialogOpen(false)
  }

  async function handleDelete(id) {
    await creditCards.remove(id)
    setList((prev) => prev.filter((c) => c.id !== id))
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
          cards
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add
        </Button>
      </Stack>

      {list.length === 0 ? (
        <Typography color="text.secondary">No cards yet.</Typography>
      ) : (
        <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          {list.map((card, idx) => {
            const days = daysUntilCut(card.billingCycle)
            const daysColor = days <= 5 ? 'error' : days <= 10 ? 'warning' : 'success'
            const cardCats = getCategoriesForCard(card)
            return (
              <Box key={card.id}>
                {idx > 0 && <Divider />}
                <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5 }} spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                      <Typography variant="body2" fontWeight={500}>
                        {card.name}
                      </Typography>
                      <Chip label={card.network} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                      {!card.isActive && (
                        <Chip label="inactive" size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                      )}
                      {days !== null && card.isActive && (
                        <Tooltip title={`Statement cuts in ${days} day${days !== 1 ? 's' : ''} · cycle ${card.billingCycle}`}>
                          <Chip
                            label={`${days}d`}
                            size="small"
                            color={daysColor}
                            sx={{ fontSize: '0.65rem', height: 18, fontWeight: 600 }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                    {cardCats.length > 0 && (
                      <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.75}>
                        {cardCats.map((cat) => (
                          <Chip
                            key={cat.id}
                            label={`${cat.icon ?? ''} ${cat.name}`.trim()}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 16, borderColor: cat.color ?? 'divider', color: cat.color ?? 'text.secondary' }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <IconButton size="small" onClick={() => openEdit(card)} aria-label="edit">
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(card.id)} aria-label="delete">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            )
          })}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'edit card' : 'new card'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Card name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              fullWidth
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>Network</InputLabel>
              <Select name="network" value={form.network} label="Network" onChange={handleChange}>
                {NETWORKS.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Billing cycle"
              name="billingCycle"
              value={form.billingCycle}
              onChange={handleChange}
              fullWidth
              placeholder="e.g. 13th–12th"
              helperText="Statement cut date (optional)"
            />
            <FormControlLabel
              control={<Switch name="isActive" checked={form.isActive} onChange={handleChange} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim() || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
