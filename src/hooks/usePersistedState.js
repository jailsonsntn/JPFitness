import { useEffect, useState } from 'react'
import { getPersistedJSONSync, removePersistedItem, setPersistedJSON } from '../services/nativePersistence'

function resolveValue(initialValue) {
  return typeof initialValue === 'function' ? initialValue() : initialValue
}

export function usePersistedState(key, initialValue, enabled = true) {
  const [state, setState] = useState(() => {
    const fallback = resolveValue(initialValue)
    const persisted = getPersistedJSONSync(key, fallback)
    return persisted ?? fallback
  })

  useEffect(() => {
    if (!enabled) return

    if (state === undefined) {
      removePersistedItem(key)
      return
    }

    setPersistedJSON(key, state)
  }, [enabled, key, state])

  return [state, setState]
}
