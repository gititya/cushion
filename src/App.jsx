import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from './styles/theme.js'
import { AuthProvider } from './contexts/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppShell from './components/AppShell.jsx'
import Login from './pages/login.jsx'
import Dashboard from './pages/dashboard.jsx'

/**
 * App -- root router.
 *
 * Protected routes render inside AppShell (sidebar nav + main content area).
 * /login is public.
 *
 * Placeholder routes are listed so React Router doesn't 404 during development.
 * Each will be replaced with a real page component in subsequent sessions.
 */

function Placeholder({ name }) {
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: '#6750A4' }}>{name}</h2>
      <p style={{ color: '#625B71' }}>Coming soon.</p>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected -- all inside AppShell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/expenses" element={<Placeholder name="Expenses" />} />
              <Route path="/expenses/new" element={<Placeholder name="New Expense" />} />
              <Route path="/income" element={<Placeholder name="Income" />} />
              <Route path="/income/new" element={<Placeholder name="New Income" />} />
              <Route path="/recurring" element={<Placeholder name="Recurring Items" />} />
              <Route path="/investments" element={<Placeholder name="Investments" />} />
              <Route path="/loans" element={<Placeholder name="Loans" />} />
              <Route path="/emis" element={<Placeholder name="EMIs" />} />
              <Route path="/settings/categories" element={<Placeholder name="Categories" />} />
              <Route path="/settings/cards" element={<Placeholder name="Credit Cards" />} />
              <Route path="/settings/budgets" element={<Placeholder name="Budgets" />} />
              <Route path="/settings/webhooks" element={<Placeholder name="Webhooks" />} />
              <Route path="/settings/account" element={<Placeholder name="Account" />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
