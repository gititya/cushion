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
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { categories } from '../../db/index.js'

const EMPTY_FORM = { name: '', icon: '', color: '#6750A4' }

export default function Categories() {
  const { currentUser } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const cats = await categories.getAll(currentUser.uid)
    setList(cats)
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(cat) {
    setEditing(cat)
    setForm({ name: cat.name, icon: cat.icon ?? '', color: cat.color ?? '#6750A4' })
    setDialogOpen(true)
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    if (editing) {
      await categories.update(editing.id, {
        name: form.name,
        icon: form.icon,
        color: form.color,
      })
      setList((prev) =>
        prev.map((c) => (c.id === editing.id ? { ...c, ...form } : c))
      )
    } else {
      const ref = await categories.add(currentUser.uid, {
        name: form.name,
        icon: form.icon,
        color: form.color,
        sortOrder: list.length,
      })
      setList((prev) => [
        ...prev,
        { id: ref.id, ...form, sortOrder: list.length, isActive: true },
      ])
    }
    setSaving(false)
    setDialogOpen(false)
  }

  async function handleDelete(id) {
    await categories.remove(id)
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
        <Typography variant="h5" fontWeight={700}>
          Categories
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add
        </Button>
      </Stack>

      {list.length === 0 ? (
        <Typography color="text.secondary">No categories yet.</Typography>
      ) : (
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          {list.map((cat, idx) => (
            <Box key={cat.id}>
              {idx > 0 && <Divider />}
              <Stack
                direction="row"
                alignItems="center"
                sx={{ px: 2, py: 1.5 }}
                spacing={2}
              >
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: cat.color ?? '#6750A4',
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>
                  {cat.icon}
                </Typography>
                <Typography variant="body1" sx={{ flex: 1 }}>
                  {cat.name}
                </Typography>
                <IconButton size="small" onClick={() => openEdit(cat)} aria-label="edit">
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(cat.id)}
                  aria-label="delete"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Emoji Icon"
              name="icon"
              value={form.icon}
              onChange={handleChange}
              fullWidth
              placeholder="e.g. 🍔"
              inputProps={{ maxLength: 4 }}
            />
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Color
              </Typography>
              <Box
                component="input"
                type="color"
                name="color"
                value={form.color}
                onChange={handleChange}
                sx={{
                  width: 48,
                  height: 32,
                  border: 'none',
                  borderRadius: 1,
                  cursor: 'pointer',
                  p: 0,
                  backgroundColor: 'transparent',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {form.color}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
