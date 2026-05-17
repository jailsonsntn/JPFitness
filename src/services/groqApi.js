const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
import {
  sendChatWithPython,
  getMotivationalQuoteWithPython,
  generateWorkoutPlanWithPython,
} from './pythonApi'

const SYSTEM_PROMPT = `Você é o JPFitness AI, um treinador pessoal e nutricionista profissional de elite. 
Você fornece conselhos de fitness personalizados, planos de treino, orientação nutricional e motivação.
Seja encorajador, específico e baseado em ciência. 
Responda em português brasileiro quando o usuário falar em português.
Mantenha respostas concisas mas informativas (máximo 300 palavras).
Use emojis ocasionalmente para tornar a conversa mais dinâmica.
Sempre termine com uma dica motivacional ou de segurança quando relevante.`

export async function sendChatMessage(messages) {
  if (!GROQ_API_KEY) {
    return sendChatWithPython(messages)
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      max_tokens: 512,
      temperature: 0.7,
      stream: false
    })
  })

  if (!response.ok) {
    return sendChatWithPython(messages)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function getMotivationalQuote() {
  if (!GROQ_API_KEY) {
    return getMotivationalQuoteWithPython()
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: 'Me dê UMA frase motivacional curta (máximo 20 palavras) sobre fitness e superação. Apenas a frase, sem aspas ou explicações extras.'
        }
      ],
      max_tokens: 80,
      temperature: 0.9
    })
  })

  if (!response.ok) return getMotivationalQuoteWithPython()
  const data = await response.json()
  return data.choices[0].message.content
}

export async function generateWorkoutPlan({ level, goal, days, equipment }) {
  if (!GROQ_API_KEY) {
    return generateWorkoutPlanWithPython({ level, goal, days, equipment })
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Crie um plano de treino semanal detalhado para:
- Nível: ${level}
- Objetivo: ${goal}
- Dias por semana: ${days}
- Equipamento disponível: ${equipment}

Formate com dias, exercícios, séries e repetições. Use markdown.`
        }
      ],
      max_tokens: 1024,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    return generateWorkoutPlanWithPython({ level, goal, days, equipment })
  }
  const data = await response.json()
  return data.choices[0].message.content
}
