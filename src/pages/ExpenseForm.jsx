import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext.jsx'
import { expenses, categories } from '../db/index.js'

const PAYMENT_METHODS = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Other']

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  description: '',
  categoryId: '',
  paymentMethod: 'UPI',
  notes: '',
}

export default function ExpenseForm() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [categoryList, setCategoryList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    async function load() {
      const cats = await categories.getAll(currentUser.uid)
      setCategoryList(cats)

      if (isEdit) {
        const all = await expenses.getAll(currentUser.uid)
        const exp = all.find((e) => e.id === id)
        if (exp) {
          setForm({
            date: exp.date,
            amount: exp.amount ?? '',
            description: exp.description ?? '',
            categoryId: exp.categoryId ?? '',
            paymentMethod: exp.paymentMethod ?? 'UPI',
            notes: exp.notes ?? '',
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [currentUser.uid, id, isEdit])

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const data = { ...form, amount: parseFloat(form.amount) }
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
      <Typography variant="h5" fontWeight={700} mb={3}>
        {isEdit ? 'Edit Expense' : 'New Expense'}
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
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
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
