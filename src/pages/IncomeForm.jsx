import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext.jsx'
import { income } from '../db/index.js'

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  source: '',
  notes: '',
}

export default function IncomeForm() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!isEdit) return
    async function load() {
      try {
        const all = await income.getAll(currentUser.uid)
        const item = all.find((i) => i.id === id)
        if (item) {
          setForm({
            date: item.date,
            amount: item.amount ?? '',
            source: item.source ?? '',
            notes: item.notes ?? '',
          })
        }
      } catch (err) {
        console.error('IncomeForm load error:', err)
      } finally {
        setLoading(false)
      }
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
      await income.update(id, data)
    } else {
      await income.add(currentUser.uid, data)
    }
    navigate('/income')
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
        {isEdit ? 'edit income' : 'new income'}
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
            label="Source"
            name="source"
            placeholder="e.g. Salary, Freelance, Dividends"
            value={form.source}
            onChange={handleChange}
            required
            fullWidth
          />

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
            <Button variant="outlined" onClick={() => navigate('/income')}>
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
