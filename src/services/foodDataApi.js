const FDC_API_KEY = import.meta.env.VITE_FDC_API_KEY
const FDC_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

function ensureKey() {
  if (!FDC_API_KEY) {
    throw new Error('VITE_FDC_API_KEY não configurada.')
  }
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function getNutrientFromArray(foodNutrients, nutrientNumber) {
  if (!Array.isArray(foodNutrients)) return 0

  const found = foodNutrients.find(item => {
    const number = item?.nutrient?.number || item?.nutrientNumber
    return String(number) === String(nutrientNumber)
  })

  if (!found) return 0
  return toNumber(found.amount ?? found.value)
}

function getNutrientPer100g(food, nutrientNumber, labelKey) {
  const labelValue = toNumber(food?.labelNutrients?.[labelKey]?.value)
  if (labelValue > 0) return labelValue

  return getNutrientFromArray(food?.foodNutrients, nutrientNumber)
}

export async function searchFoods(query, pageSize = 8) {
  ensureKey()

  const url = `${FDC_BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${FDC_API_KEY}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Falha ao buscar alimentos no FoodData Central.')
  }

  const data = await response.json()
  return data?.foods || []
}

export function calculateNutritionFromFood(food, quantityG = 100) {
  const qty = Math.max(1, toNumber(quantityG) || 100)
  const factor = qty / 100

  const calories100 = getNutrientPer100g(food, 1008, 'calories')
  const protein100 = getNutrientPer100g(food, 1003, 'protein')
  const carbs100 = getNutrientPer100g(food, 1005, 'carbohydrates')
  const fat100 = getNutrientPer100g(food, 1004, 'fat')
  const fiber100 = getNutrientPer100g(food, 1079, 'fiber')

  return {
    calories: Math.round(calories100 * factor),
    protein: Math.round(protein100 * factor * 10) / 10,
    carbs: Math.round(carbs100 * factor * 10) / 10,
    fat: Math.round(fat100 * factor * 10) / 10,
    fiber: Math.round(fiber100 * factor * 10) / 10,
  }
}
