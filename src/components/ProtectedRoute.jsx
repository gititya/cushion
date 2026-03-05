import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

/**
 * Wraps any route that requires authentication.
 * Unauthenticated users are redirected to /login.
 */
export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/login" replace />
}
