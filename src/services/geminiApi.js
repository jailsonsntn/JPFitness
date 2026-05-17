const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'

async function generateContent(prompt, options = {}) {
  const { maxOutputTokens = 1024, temperature = 0.7 } = options

  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY não configurada.')
  }

  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens
        }
      })
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error (${response.status})`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta'
}

export async function analyzeMeal(description) {
  const prompt = `Analise esta refeição e forneça informações nutricionais em português brasileiro:
Refeição: "${description}"

Retorne em formato JSON válido com esta estrutura exata:
{
  "name": "nome da refeição",
  "calories": número,
  "protein": número em gramas,
  "carbs": número em gramas,
  "fat": número em gramas,
  "fiber": número em gramas,
  "tips": ["dica 1", "dica 2"],
  "rating": número de 1 a 10 (qualidade nutricional),
  "summary": "breve análise em uma frase"
}

Retorne APENAS o JSON, sem texto adicional.`

  const text = await generateContent(prompt)
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    throw new Error('JSON inválido')
  } catch {
    return {
      name: description,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      tips: ['Não foi possível analisar esta refeição com precisão.'],
      rating: 5,
      summary: 'Análise indisponível no momento.'
    }
  }
}

export async function generateMealPlan({ goal, calories, restrictions }) {
  const prompt = `Crie um plano alimentar completo e detalhado para um dia em português brasileiro:
- Objetivo: ${goal}
- Meta calórica: ${calories} kcal
- Restrições: ${restrictions || 'nenhuma'}

FORMATO OBRIGATÓRIO (markdown):
### Resumo
### 1. Café da manhã
### 2. Lanche da manhã
### 3. Almoço
### 4. Lanche da tarde
### 5. Jantar
### Total diário de macros
### Dicas práticas

Para CADA refeição, inclua obrigatoriamente:
- lista de alimentos com porções
- calorias aproximadas
- proteína, carboidrato e gordura da refeição

No total diário, some macros e calorias aproximadas.
Use alimentos comuns no Brasil e linguagem prática.
Nao responda de forma resumida. Entregue o plano completo.

Retorne apenas o plano em markdown.`

  let result = await generateContent(prompt, { maxOutputTokens: 2048, temperature: 0.65 })

  const isTooShort = String(result || '').length < 650
  const hasCoreMeals = /(Caf[ée] da manh[ãa]|Almo[cç]o|Jantar)/i.test(result || '')

  if (isTooShort || !hasCoreMeals) {
    const retryPrompt = `${prompt}\n\nA resposta anterior veio curta. Reescreva completa seguindo todos os títulos obrigatórios.`
    result = await generateContent(retryPrompt, { maxOutputTokens: 2048, temperature: 0.6 })
  }

  return result
}

export async function getNutritionTip(goal) {
  const prompt = `Me dê uma dica nutricional curta e prática (máximo 2 frases) para quem tem como objetivo: ${goal}. Em português brasileiro.`
  return generateContent(prompt)
}
