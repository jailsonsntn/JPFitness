function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function resolveProfileAge(profile = {}) {
  const directAge = Number(profile?.age || 0)
  if (directAge > 0) return directAge

  if (profile?.birth_date) {
    const birth = new Date(profile.birth_date)
    if (!Number.isNaN(birth.getTime())) {
      const now = new Date()
      return Math.max(0, Math.floor((now - birth) / (365.25 * 24 * 60 * 60 * 1000)))
    }
  }

  return 0
}

const SESSION_DURATION_HINT_MIN = {
  1: 22,
  2: 24,
  3: 26,
  4: 28,
  5: 30,
  6: 32,
}

function getSessionDurationHintMinutes(name = '') {
  const normalized = normalizeText(name)
  if (!normalized) return 0

  const sessionMatch = normalized.match(/(?:sessao|treino|dia)\s*(\d{1,2})/)
  if (sessionMatch) {
    const index = Number(sessionMatch[1])
    return SESSION_DURATION_HINT_MIN[index] || 0
  }

  const shortMatch = normalized.match(/\bs(\d)\b/)
  if (shortMatch) {
    const index = Number(shortMatch[1])
    return SESSION_DURATION_HINT_MIN[index] || 0
  }

  return 0
}

export function resolveStrengthDurationSeconds({
  durationSeconds,
  sessionMeta = {},
  workoutName = '',
  plannedDurationMin = 0,
}) {
  const rawSeconds = Number(durationSeconds || sessionMeta?.durationSeconds || 0)
  const metaMinutes = Number(sessionMeta?.durationMin || 0)
  const rawMinutes = rawSeconds > 0 ? rawSeconds / 60 : metaMinutes

  const hintMinutes = getSessionDurationHintMinutes(
    [sessionMeta?.sessionName, sessionMeta?.workoutName, workoutName].filter(Boolean).join(' ')
  )
  const plannedMinutes = Number(plannedDurationMin || 0)

  let resolvedMinutes = rawMinutes

  if (resolvedMinutes <= 0) {
    resolvedMinutes = hintMinutes || plannedMinutes || 0
  } else if (resolvedMinutes < 8 && hintMinutes > 0) {
    // Evita subestimação quando o cronômetro ficou baixo/inconsistente.
    resolvedMinutes = Math.max(resolvedMinutes, hintMinutes)
  }

  return Math.round(Math.max(0, resolvedMinutes) * 60)
}

const KEYWORD_INTENSITY = [
  { score: 1.0, terms: ['agachamento', 'squat', 'levantamento terra', 'deadlift', 'barra fixa', 'pull up', 'supino', 'bench press', 'thruster', 'clean', 'snatch'] },
  { score: 0.9, terms: ['leg press', 'afundo', 'passada', 'remada curvada', 'desenvolvimento', 'paralela', 'stiff'] },
  { score: 0.75, terms: ['puxada', 'remada', 'rosca', 'triceps', 'triceps', 'elevacao lateral', 'elevacao pelvica', 'mesa flexora', 'cadeira extensora'] },
  { score: 0.6, terms: ['panturrilha', 'abdominal', 'prancha', 'core', 'crucifixo', 'voador'] },
]

export function estimateExerciseIntensityFromNames(exerciseNames = []) {
  const unique = Array.from(new Set((exerciseNames || [])
    .map(name => normalizeText(name).trim())
    .filter(Boolean)))

  if (unique.length === 0) {
    return { score: 0.55, label: 'moderado' }
  }

  const scores = unique.map(name => {
    for (const entry of KEYWORD_INTENSITY) {
      if (entry.terms.some(term => name.includes(term))) {
        return entry.score
      }
    }
    return 0.7
  })

  const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length
  const score = clamp(avg, 0.45, 1.0)

  let label = 'moderado'
  if (score >= 0.88) label = 'vigoroso'
  else if (score >= 0.72) label = 'moderado-forte'

  return { score, label }
}

export function estimateStrengthCaloriesByProfile({ durationSeconds, profile = {}, sessionMeta = {}, exerciseNames = [] }) {
  const minutes = Number(durationSeconds || 0) / 60
  const bodyWeight = Number(profile?.weight_kg || profile?.weightKg || 0)

  if (minutes <= 0 || bodyWeight <= 0) {
    return { calories: 0, baseCalories: 0, metCalories: 0, met: 0, intensityLabel: 'n/a' }
  }

  const baseCalories = minutes * bodyWeight * 0.0675

  const age = resolveProfileAge(profile)
  const heightCm = Number(profile?.height_cm || profile?.heightCm || 0)

  const ageFactor = age > 0
    ? clamp(age < 25 ? 1.03 : 1.03 - ((age - 25) * 0.0035), 0.87, 1.05)
    : 1

  const heightFactor = heightCm > 0
    ? clamp(0.96 + ((heightCm - 170) * 0.0016), 0.9, 1.1)
    : 1

  const completionRate = Number(sessionMeta?.completionRate || 0)
  const completedSets = Number(sessionMeta?.completedSets || 0)
  const totalSets = Number(sessionMeta?.totalSets || 0)
  const sessionLoad = Number(sessionMeta?.sessionLoad || 0)

  const density = completedSets > 0 ? completedSets / Math.max(minutes, 1) : 0
  const loadPerMinute = sessionLoad > 0 ? sessionLoad / Math.max(minutes, 1) : 0

  const intensity = estimateExerciseIntensityFromNames(exerciseNames)

  let met = 4.5 + (2.0 * intensity.score)
  if (completionRate >= 90 || totalSets >= 20) met += 0.35
  else if (completionRate >= 75 || totalSets >= 12) met += 0.2

  if (density >= 0.9) met += 0.35
  else if (density >= 0.6) met += 0.2

  if (loadPerMinute >= 250) met += 0.3
  else if (loadPerMinute >= 150) met += 0.2
  else if (loadPerMinute >= 80) met += 0.1

  met = clamp(met, 4.2, 6.8)

  const metCalories = met * bodyWeight * (minutes / 60)

  const blendedCalories = ((baseCalories * 0.75) + (metCalories * 0.25))
    * ageFactor
    * heightFactor

  const calories = Math.max(baseCalories * 0.85, blendedCalories)

  return {
    calories,
    baseCalories,
    metCalories,
    met,
    intensityScore: intensity.score,
    intensityLabel: intensity.label,
    ageFactor,
    heightFactor,
  }
}
