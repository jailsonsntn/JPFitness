const PYTHON_API_URL = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const response = await fetch(`${PYTHON_API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || 'Python API error')
  }

  return response.json()
}

export async function sendChatWithPython(messages) {
  const data = await request('/api/chat/reply', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
  return data.reply
}

export async function getMotivationalQuoteWithPython() {
  const data = await request('/api/motivation/quote')
  return data.quote
}

export async function generateWorkoutPlanWithPython(payload) {
  const days = Number(payload?.days || 3)
  const data = await request('/api/workouts/generate', {
    method: 'POST',
    body: JSON.stringify({
      level: payload?.level || 'Intermediário',
      goal: payload?.goal || 'Ganho de massa muscular',
      days,
      equipment: payload?.equipment || 'Academia completa',
    }),
  })
  return data.plan
}
