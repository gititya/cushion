import { createContext, useContext, useEffect, useState } from 'react'
import { authAPI } from '../db/index.js'

/**
 * AuthContext -- provides currentUser and login/logout helpers.
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

  async function login(email, password) {
    return authAPI.signIn(email, password)
  }

  async function logout() {
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
