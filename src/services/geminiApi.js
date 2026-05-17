const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-1.5-flash'

async function generateContent(prompt) {
  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      })
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Gemini API error')
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
  const prompt = `Crie um plano alimentar completo para um dia em português brasileiro:
- Objetivo: ${goal}
- Meta calórica: ${calories} kcal
- Restrições: ${restrictions || 'nenhuma'}

Formate como markdown com:
- 3 refeições principais + 2 lanches
- Para cada refeição: nome, alimentos, porções estimadas e macros (cal, prot, carb, gord)
- Dicas de preparação
- Total diário de macros no final

Seja prático e use alimentos acessíveis no Brasil.`

  return generateContent(prompt)
}

export async function getNutritionTip(goal) {
  const prompt = `Me dê uma dica nutricional curta e prática (máximo 2 frases) para quem tem como objetivo: ${goal}. Em português brasileiro.`
  return generateContent(prompt)
}
