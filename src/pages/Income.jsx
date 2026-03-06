import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { useAuth } from '../contexts/AuthContext.jsx'
import { income } from '../db/index.js'

function getMonthLabel(yyyy, mm) {
  return new Date(yyyy, mm - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function buildMonthOptions(items) {
  const seen = new Set()
  for (const item of items) {
    const [yyyy, mm] = item.date.split('-')
    seen.add(`${yyyy}-${mm}`)
  }
  return Array.from(seen)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const [yyyy, mm] = key.split('-')
      return { key, label: getMonthLabel(Number(yyyy), Number(mm)) }
    })
}

export default function Income() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [incomeList, setIncomeList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const items = await income.getAll(currentUser.uid)
        setIncomeList(items)
      } catch (err) {
        console.error('Income load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser.uid])

  async function handleDelete(id) {
    await income.remove(id)
    setIncomeList((prev) => prev.filter((i) => i.id !== id))
  }

  const monthOptions = useMemo(() => buildMonthOptions(incomeList), [incomeList])

  const filtered = useMemo(() => {
    if (!selectedMonth) return incomeList
    return incomeList.filter((i) => i.date.startsWith(selectedMonth))
  }, [incomeList, selectedMonth])

  const grouped = useMemo(() => {
    const map = {}
    for (const item of filtered) {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const total = useMemo(
    () => filtered.reduce((sum, i) => sum + (i.amount || 0), 0),
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
      <Alert severity="info" sx={{ mb: 2 }}>
        Income data setup in progress — historical records coming soon.
      </Alert>

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          Income
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/income/new')}
        >
          Add
        </Button>
      </Stack>

      <Typography variant="subtitle1" color="text.secondary" mb={2}>
        Total:{' '}
        <strong>
          ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </strong>
        {selectedMonth && ` in ${monthOptions.find((m) => m.key === selectedMonth)?.label}`}
      </Typography>

      {/* Month filter chips */}
      <Stack direction="row" spacing={1} mb={3} flexWrap="wrap" useFlexGap>
        <Chip
          label="All"
          onClick={() => setSelectedMonth(null)}
          color={selectedMonth === null ? 'primary' : 'default'}
          variant={selectedMonth === null ? 'filled' : 'outlined'}
        />
        {monthOptions.map(({ key, label }) => (
          <Chip
            key={key}
            label={label}
            onClick={() => setSelectedMonth(key === selectedMonth ? null : key)}
            color={selectedMonth === key ? 'primary' : 'default'}
            variant={selectedMonth === key ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {grouped.length === 0 ? (
        <Typography color="text.secondary">No income entries found.</Typography>
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
              {items.map((item, idx) => (
                <Box key={item.id}>
                  {idx > 0 && <Divider />}
                  <Stack
                    direction="row"
                    alignItems="center"
                    sx={{ px: 2, py: 1.5 }}
                    spacing={2}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" fontWeight={500} noWrap>
                        {item.source || '—'}
                      </Typography>
                      {item.notes && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.notes}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="body1"
                      fontWeight={600}
                      sx={{ flexShrink: 0, color: 'success.main' }}
                    >
                      +₹{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/income/${item.id}/edit`)}
                      aria-label="edit"
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(item.id)}
                      aria-label="delete"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  )
}
