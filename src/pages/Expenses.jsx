import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useAuth } from '../contexts/AuthContext.jsx'
import { expenses, categories } from '../db/index.js'

export default function Expenses() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [expenseList, setExpenseList] = useState([])
  const [categoryList, setCategoryList] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [exps, cats] = await Promise.all([
          expenses.getAll(currentUser.uid),
          categories.getAll(currentUser.uid),
        ])
        setExpenseList(exps)
        setCategoryList(cats)
      } catch (err) {
        console.error('Expenses load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser.uid])

  async function handleDelete(id) {
    await expenses.remove(id)
    setExpenseList((prev) => prev.filter((e) => e.id !== id))
  }

  const catMap = useMemo(
    () => Object.fromEntries(categoryList.map((c) => [c.id, c])),
    [categoryList]
  )

  const filtered = useMemo(
    () =>
      selectedCategory
        ? expenseList.filter((e) => e.categoryId === selectedCategory)
        : expenseList,
    [expenseList, selectedCategory]
  )

  const grouped = useMemo(() => {
    const map = {}
    for (const exp of filtered) {
      const key = exp.date
      if (!map[key]) map[key] = []
      map[key].push(exp)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const total = useMemo(
    () => filtered.reduce((sum, e) => sum + (e.amount || 0), 0),
    [filtered]
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          Expenses
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/expenses/new')}
        >
          Add
        </Button>
      </Stack>

      <Typography variant="subtitle1" color="text.secondary" mb={2}>
        Total:{' '}
        <strong>
          ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </strong>
      </Typography>

      <Stack direction="row" spacing={1} mb={3} flexWrap="wrap" useFlexGap>
        <Chip
          label="All"
          onClick={() => setSelectedCategory(null)}
          color={selectedCategory === null ? 'primary' : 'default'}
          variant={selectedCategory === null ? 'filled' : 'outlined'}
        />
        {categoryList.map((cat) => (
          <Chip
            key={cat.id}
            label={`${cat.icon ?? ''} ${cat.name}`.trim()}
            onClick={() =>
              setSelectedCategory(cat.id === selectedCategory ? null : cat.id)
            }
            color={selectedCategory === cat.id ? 'primary' : 'default'}
            variant={selectedCategory === cat.id ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {grouped.length === 0 ? (
        <Typography color="text.secondary">No expenses found.</Typography>
      ) : (
        grouped.map(([date, items]) => (
          <Box key={date} mb={3}>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>
              {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Typography>
            <Box
              sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              {items.map((exp, idx) => {
                const cat = catMap[exp.categoryId]
                return (
                  <Box key={exp.id}>
                    {idx > 0 && <Divider />}
                    <Stack
                      direction="row"
                      alignItems="center"
                      sx={{ px: 2, py: 1.5 }}
                      spacing={2}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={500} noWrap>
                          {exp.description || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {cat
                            ? `${cat.icon ?? ''} ${cat.name}`.trim()
                            : 'Uncategorised'}{' '}
                          · {exp.paymentMethod}
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight={600} sx={{ flexShrink: 0 }}>
                        ₹
                        {(exp.amount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(exp.id)}
                        aria-label="delete"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                )
              })}
            </Box>
          </Box>
        ))
      )}
    </Box>
  )
}
