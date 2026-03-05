import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [encKey, setEncKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!encKey.trim()) {
      setError('Encryption key is required.')
      return
    }

    try {
      setLoading(true)
      await login(email, password, encKey)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err.code))
    } finally {
      setLoading(false)
    }
  }

  function getErrorMessage(code) {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect email or password.'
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Try again later.'
      case 'auth/network-request-failed':
        return 'Network error. Check your connection.'
      default:
        return 'Sign in failed. Try again.'
    }
  }

  return (
    <Box
      className="min-h-screen flex items-center justify-center gradient-hero"
      sx={{ p: 2 }}
    >
      <Card sx={{ maxWidth: 420, width: '100%', borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo / brand */}
          <Box className="flex flex-col items-center mb-6">
            <Box
              className="gradient-hero flex items-center justify-center rounded-full mb-3"
              sx={{ width: 56, height: 56 }}
            >
              <LockOutlinedIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} color="primary">
              Cushion
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Your personal finance tracker
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Encryption key"
              type={showKey ? 'text' : 'password'}
              value={encKey}
              onChange={(e) => setEncKey(e.target.value)}
              required
              fullWidth
              helperText="Your personal key for encrypting financial data. Keep it safe -- it cannot be recovered."
              autoComplete="off"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowKey((v) => !v)}
                      edge="end"
                      size="small"
                    >
                      {showKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ mt: 1, py: 1.5 }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
