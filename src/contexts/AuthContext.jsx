import { createContext, useContext, useEffect, useState } from 'react'
import { authAPI, setEncKey, clearEncKey } from '../db/index.js'

/**
 * AuthContext -- provides currentUser and login/logout helpers.
 *
 * Encryption key lifecycle:
 *   - Stored in sessionStorage under 'cushion_enc_key' (see db/index.js)
 *   - Set here at login time (user provides the key alongside credentials)
 *   - Cleared here at logout time
 *   - Never persists across browser sessions (sessionStorage is tab-scoped)
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = authAPI.onStateChanged((user) => {
      setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  /**
   * Sign in with email + password + encryption key.
   * The encryption key is kept in sessionStorage for this tab session only.
   */
  async function login(email, password, encryptionKey) {
    const result = await authAPI.signIn(email, password)
    setEncKey(encryptionKey)
    return result
  }

  async function logout() {
    clearEncKey()
    return authAPI.signOut()
  }

  const value = { currentUser, login, logout, loading }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
