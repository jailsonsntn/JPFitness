import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { LocalNotifications } from '@capacitor/local-notifications'
import { App as CapacitorApp } from '@capacitor/app'

const NATIVE_STORAGE_PREFIX = 'jpfitness.native.'
const SESSION_TIMEOUT_DAYS = 7
const NOTIFICATION_PERMISSION_ASKED_KEY = 'jpfitness:notifications-permission-requested'

export const LAST_ROUTE_KEY = 'jpfitness:last-route'
export const LAST_ACTIVE_AT_KEY = 'jpfitness:last-active-at'

function nativeKey(key) {
  return `${NATIVE_STORAGE_PREFIX}${key}`
}

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

export async function bootstrapNativePersistence() {
  if (!isNativeApp()) return

  try {
    const { keys } = await Preferences.keys()
    const persistedKeys = keys.filter(key => key.startsWith(NATIVE_STORAGE_PREFIX))

    await Promise.all(persistedKeys.map(async (key) => {
      const { value } = await Preferences.get({ key })
      if (value !== null) {
        localStorage.setItem(key.slice(NATIVE_STORAGE_PREFIX.length), value)
      }
    }))
  } catch {}
}

export function getPersistedItemSync(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export async function getPersistedItem(key) {
  const localValue = getPersistedItemSync(key)
  if (localValue !== null) return localValue

  if (!isNativeApp()) return null

  try {
    const { value } = await Preferences.get({ key: nativeKey(key) })
    if (value !== null) {
      localStorage.setItem(key, value)
    }
    return value
  } catch {
    return null
  }
}

export async function setPersistedItem(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, String(value))
  } catch {}

  if (!isNativeApp()) return

  try {
    if (value === null || value === undefined) {
      await Preferences.remove({ key: nativeKey(key) })
    } else {
      await Preferences.set({ key: nativeKey(key), value: String(value) })
    }
  } catch {}
}

export async function removePersistedItem(key) {
  await setPersistedItem(key, null)
}

export function getPersistedJSONSync(key, fallback = null) {
  const raw = getPersistedItemSync(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function getPersistedJSON(key, fallback = null) {
  const raw = await getPersistedItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function setPersistedJSON(key, value) {
  await setPersistedItem(key, JSON.stringify(value))
}

export async function touchLastActiveAt() {
  await setPersistedItem(LAST_ACTIVE_AT_KEY, String(Date.now()))
}

export async function hasExceededInactivityTimeout(days = SESSION_TIMEOUT_DAYS) {
  const raw = await getPersistedItem(LAST_ACTIVE_AT_KEY)
  if (!raw) return false

  const lastActiveAt = Number(raw)
  if (!Number.isFinite(lastActiveAt)) return false

  return (Date.now() - lastActiveAt) > (days * 24 * 60 * 60 * 1000)
}

export async function clearSessionPersistence() {
  await Promise.all([
    removePersistedItem(LAST_ACTIVE_AT_KEY),
    removePersistedItem(LAST_ROUTE_KEY),
  ])
}

export async function requestEssentialPermissions() {
  if (!isNativeApp()) return

  const alreadyAsked = await getPersistedItem(NOTIFICATION_PERMISSION_ASKED_KEY)
  if (alreadyAsked === '1') return

  try {
    const permissions = await LocalNotifications.checkPermissions()
    if (permissions.display !== 'granted') {
      await LocalNotifications.requestPermissions()
    }
  } catch {}

  await setPersistedItem(NOTIFICATION_PERMISSION_ASKED_KEY, '1')
}

export function registerNativeResumeListener(onResume) {
  if (!isNativeApp()) return () => {}

  const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onResume?.()
  })

  return () => {
    Promise.resolve(listener)
      .then(handle => handle?.remove())
      .catch(() => {})
  }
}

export const supabaseStorage = {
  getItem: async (key) => getPersistedItem(key),
  setItem: async (key, value) => setPersistedItem(key, value),
  removeItem: async (key) => removePersistedItem(key),
}
