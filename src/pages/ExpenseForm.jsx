import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useAuth } from '../contexts/AuthContext.jsx'
import { expenses, categories, creditCards } from '../db/index.js'
import { parseExpenseNL } from '../claude.js'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'net_banking', label: 'Net Banking' },
]

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  description: '',
  categoryId: '',
  paymentMethod: 'upi',
  cardId: '',
  notes: '',
}

function resolveDate(val) {
  if (!val || val === 'today') return new Date().toISOString().slice(0, 10)
  if (val === 'yesterday') {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return val
}

export default function ExpenseForm() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [categoryList, setCategoryList] = useState([])
  const [cardList, setCardList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const [nlInput, setNlInput] = useState('')
  const [nlParsing, setNlParsing] = useState(false)
  const [nlError, setNlError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [cats, cards] = await Promise.all([
          categories.getAll(currentUser.uid),
          creditCards.getAll(currentUser.uid),
        ])
        setCategoryList(cats)
        setCardList(cards)

        if (isEdit) {
          const all = await expenses.getAll(currentUser.uid)
          const exp = all.find((e) => e.id === id)
          if (exp) {
            setForm({
              date: exp.date,
              amount: exp.amount ?? '',
              description: exp.description ?? '',
              categoryId: exp.categoryId ?? '',
              paymentMethod: exp.paymentMethod ?? 'upi',
              cardId: exp.cardId ?? '',
              notes: exp.notes ?? '',
            })
          }
        }
      } catch (err) {
        console.error('ExpenseForm load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser.uid, id, isEdit])

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      // Clear card when switching away from credit_card
      if (name === 'paymentMethod' && value !== 'credit_card') {
        next.cardId = ''
      }
      return next
    })
  }

  async function handleNlParse() {
    if (!nlInput.trim()) return
    setNlParsing(true)
    setNlError(null)
    try {
      const parsed = await parseExpenseNL(nlInput, categoryList, cardList)
      setForm((prev) => ({
        ...prev,
        date: resolveDate(parsed.date) || prev.date,
        amount: parsed.amount != null ? String(parsed.amount) : prev.amount,
        description: parsed.description ?? prev.description,
        categoryId: parsed.categoryId ?? prev.categoryId,
        paymentMethod: parsed.paymentMethod ?? prev.paymentMethod,
        cardId: parsed.cardId ?? prev.cardId,
      }))
    } catch {
      setNlError('Could not reach Claude. Fill in the fields manually.')
    } finally {
      setNlParsing(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const data = {
      ...form,
      amount: parseFloat(form.amount),
      cardId: form.paymentMethod === 'credit_card' ? form.cardId || null : null,
    }
    if (isEdit) {
      await expenses.update(id, data)
    } else {
      await expenses.add(currentUser.uid, data)
    }
    navigate('/expenses')
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 520, mx: 'auto' }}>
      <Typography variant="h6" fontWeight={700} mb={3}>
        {isEdit ? 'edit expense' : 'new expense'}
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          {/* NL input -- new entry only */}
          {!isEdit && (
            <TextField
              label="Describe the expense (optional)"
              placeholder="e.g. paid 450 for coffee at Blue Tokai via HDFC card"
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNlParse())}
              fullWidth
              multiline
              rows={2}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ alignSelf: 'flex-end', mb: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleNlParse}
                      disabled={nlParsing || !nlInput.trim()}
                      startIcon={nlParsing ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                    >
                      {nlParsing ? 'Parsing…' : 'Parse'}
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {nlError && <Alert severity="warning">{nlError}</Alert>}

          <TextField
            label="Date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Amount (₹)"
            name="amount"
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            value={form.amount}
            onChange={handleChange}
            required
            fullWidth
          />

          <TextField
            label="Description"
            name="description"
            value={form.description}
            onChange={handleChange}
            fullWidth
          />

          <FormControl fullWidth required>
            <InputLabel>Category</InputLabel>
            <Select
              name="categoryId"
              value={form.categoryId}
              label="Category"
              onChange={handleChange}
            >
              {categoryList.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {`${cat.icon ?? ''} ${cat.name}`.trim()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Payment Method</InputLabel>
            <Select
              name="paymentMethod"
              value={form.paymentMethod}
              label="Payment Method"
              onChange={handleChange}
            >
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {form.paymentMethod === 'credit_card' && (
            <FormControl fullWidth>
              <InputLabel>Credit Card</InputLabel>
              <Select
                name="cardId"
                value={form.cardId}
                label="Credit Card"
                onChange={handleChange}
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                {cardList.map((card) => (
                  <MenuItem key={card.id} value={card.id}>
                    {card.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            fullWidth
            multiline
            rows={3}
          />

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={() => navigate('/expenses')}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}
