import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LAST_ROUTE_KEY,
  getPersistedItemSync,
  registerNativeResumeListener,
  requestEssentialPermissions,
  setPersistedItem,
  touchLastActiveAt,
} from '../services/nativePersistence'

const NON_PERSISTED_ROUTES = new Set(['/', '/auth'])

export default function AppRuntime() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const restoredRef = useRef(false)

  useEffect(() => {
    requestEssentialPermissions().catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      restoredRef.current = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (loading || !isAuthenticated || restoredRef.current) return

    const currentPath = location.pathname
    const savedRoute = getPersistedItemSync(LAST_ROUTE_KEY)

    if (NON_PERSISTED_ROUTES.has(currentPath) && savedRoute && !NON_PERSISTED_ROUTES.has(savedRoute)) {
      restoredRef.current = true
      navigate(savedRoute, { replace: true })
      return
    }

    restoredRef.current = true
  }, [isAuthenticated, loading, location.pathname, navigate])

  useEffect(() => {
    if (!isAuthenticated) return
    if (NON_PERSISTED_ROUTES.has(location.pathname)) return

    setPersistedItem(LAST_ROUTE_KEY, location.pathname).catch(() => {})
    touchLastActiveAt().catch(() => {})
  }, [isAuthenticated, location.pathname])

  useEffect(() => {
    if (!isAuthenticated) return

    const markActive = () => touchLastActiveAt().catch(() => {})
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActive()
      }
    }

    window.addEventListener('focus', markActive)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const removeNativeListener = registerNativeResumeListener(markActive)

    return () => {
      window.removeEventListener('focus', markActive)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      removeNativeListener()
    }
  }, [isAuthenticated])

  return null
}
