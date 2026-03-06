import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SearchIcon from '@mui/icons-material/Search'
import { useAuth } from '../contexts/AuthContext.jsx'
import { expenses, categories } from '../db/index.js'

export default function Expenses() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [expenseList, setExpenseList] = useState([])
  const [categoryList, setCategoryList] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [search, setSearch] = useState('')
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

  const monthOptions = useMemo(() => {
    const seen = new Set()
    for (const e of expenseList) {
      const [yyyy, mm] = e.date.split('-')
      seen.add(`${yyyy}-${mm}`)
    }
    return Array.from(seen)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [yyyy, mm] = key.split('-')
        const label = new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        })
        return { key, label }
      })
  }, [expenseList])

  const filtered = useMemo(() => {
    let list = expenseList
    if (selectedMonth) list = list.filter((e) => e.date.startsWith(selectedMonth))
    if (selectedCategory) list = list.filter((e) => e.categoryId === selectedCategory)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((e) => e.description?.toLowerCase().includes(q))
    }
    return list
  }, [expenseList, selectedMonth, selectedCategory, search])

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
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
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
        {filtered.length !== expenseList.length && (
          <Typography component="span" variant="caption" color="text.secondary" ml={1}>
            ({filtered.length} of {expenseList.length} entries)
          </Typography>
        )}
      </Typography>

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
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

      <Stack direction="row" spacing={1} mb={2} alignItems="center">
        <FormControl size="small" sx={{ width: 160 }}>
          <InputLabel>Month</InputLabel>
          <Select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            label="Month"
          >
            <MenuItem value="">All</MenuItem>
            {monthOptions.map(({ key, label }) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Search description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {filtered.length === 0 ? (
        <Typography color="text.secondary">No expenses found.</Typography>
      ) : (
        <TableContainer
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' } }}>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((exp) => {
                const cat = catMap[exp.categoryId]
                const dateStr = new Date(exp.date + 'T00:00:00').toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
                return (
                  <TableRow
                    key={exp.id}
                    hover
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                    onClick={() => navigate(`/expenses/${exp.id}/edit`)}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8rem' }}>
                      {dateStr}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {exp.description || '—'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {cat ? `${cat.icon ?? ''} ${cat.name}`.trim() : 'Uncategorised'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      ₹{(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(exp.id)}
                        aria-label="delete"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
