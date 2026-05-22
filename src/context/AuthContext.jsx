import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { getProfile, getStreak, signOut } from '../services/dbService'
import { hasExceededInactivityTimeout, touchLastActiveAt } from '../services/nativePersistence'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUserData = useCallback(async (userId) => {
    try {
      const [prof, str] = await Promise.all([
        getProfile(userId),
        getStreak(userId)
      ])
      setProfile(prof)
      setStreak(str)
    } catch {
      // profile pode não existir ainda (trigger ainda processando)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async (session) => {
      if (!isMounted) return

      if (session?.user) {
        const expired = await hasExceededInactivityTimeout()
        if (expired) {
          await signOut().catch(() => {})
          if (!isMounted) return
          setUser(null)
          setProfile(null)
          setStreak(null)
          setLoading(false)
          return
        }

        setUser(session.user)
        await touchLastActiveAt()
        loadUserData(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setStreak(null)
      }

      if (isMounted) setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateSession(session)
    })

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateSession(session)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadUserData])

  const refreshProfile = useCallback(async () => {
    if (user) {
      const prof = await getProfile(user.id)
      setProfile(prof)
    }
  }, [user])

  const refreshStreak = useCallback(async () => {
    if (user) {
      const str = await getStreak(user.id)
      setStreak(str)
    }
  }, [user])

  const value = {
    user,
    profile,
    streak,
    loading,
    refreshProfile,
    refreshStreak,
    isAuthenticated: !!user
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
