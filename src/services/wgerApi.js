// wger public API - https://wger.de/api/v2/
const BASE_URL = 'https://wger.de/api/v2'

export async function getExerciseCategories() {
  const res = await fetch(`${BASE_URL}/exercisecategory/?format=json`)
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json()
}

export async function getMuscles() {
  const res = await fetch(`${BASE_URL}/muscle/?format=json`)
  if (!res.ok) throw new Error('Failed to fetch muscles')
  return res.json()
}

export async function getExercises({ category = null, offset = 0, limit = 20 } = {}) {
  let url = `${BASE_URL}/exerciseinfo/?language=7&format=json&limit=${limit}&offset=${offset}`
  if (category) url += `&category=${category}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch exercises')
  return res.json()
}

export async function searchExercises(term) {
  const res = await fetch(
    `${BASE_URL}/exercise/search/?term=${encodeURIComponent(term)}&language=portuguese&format=json`
  )
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export async function getExerciseById(id) {
  const res = await fetch(`${BASE_URL}/exerciseinfo/${id}/?format=json`)
  if (!res.ok) throw new Error('Failed to fetch exercise')
  return res.json()
}

export async function getEquipment() {
  const res = await fetch(`${BASE_URL}/equipment/?format=json`)
  if (!res.ok) throw new Error('Failed to fetch equipment')
  return res.json()
}
