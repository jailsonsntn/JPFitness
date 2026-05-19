import { supabase } from './supabase'

const WORKOUT_LOG_META_PREFIX = '__JPFITNESS_LOG_META__'

function buildWorkoutLogNotes(notesText, logMeta) {
  const cleanText = (notesText || '').trim()
  if (!logMeta) return cleanText || null

  const payload = `${WORKOUT_LOG_META_PREFIX}${JSON.stringify(logMeta)}`
  if (!cleanText) return payload
  return `${cleanText}\n\n${payload}`
}

export function parseWorkoutLogMeta(notes) {
  if (!notes || typeof notes !== 'string') {
    return { noteText: '', meta: null }
  }

  const markerIndex = notes.indexOf(WORKOUT_LOG_META_PREFIX)
  if (markerIndex === -1) {
    return { noteText: notes, meta: null }
  }

  const noteText = notes.slice(0, markerIndex).trim()
  const rawMeta = notes.slice(markerIndex + WORKOUT_LOG_META_PREFIX.length).trim()

  try {
    return { noteText, meta: JSON.parse(rawMeta) }
  } catch {
    return { noteText: notes, meta: null }
  }
}

// ─── AUTH ────────────────────────────────────────────────────

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  })
  if (error) throw error
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// ─── PROFILE ─────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertProfile(profile) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── USER STREAKS ─────────────────────────────────────────────

export async function getStreak(userId) {
  const { data, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ─── WORKOUTS ─────────────────────────────────────────────────

export async function getWorkouts(userId) {
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      *,
      workout_exercises ( * )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createWorkout(workout) {
  const { exercises, ...workoutData } = workout
  const { data, error } = await supabase
    .from('workouts')
    .insert(workoutData)
    .select()
    .single()
  if (error) throw error

  if (exercises?.length) {
    const exRows = exercises.map((ex, i) => ({
      workout_id: data.id,
      exercise_name: ex.name || ex.exercise_name,
      exercise_id: ex.exercise_id || null,
      sets: ex.sets,
      reps: ex.reps,
      rest_seconds: ex.rest_seconds || parseRestToSeconds(ex.rest),
      weight_kg: parseWeightToKg(ex.weight_kg ?? ex.weightKg),
      notes: ex.notes?.trim() || null,
      order_index: i
    }))
    const { error: exErr } = await supabase.from('workout_exercises').insert(exRows)
    if (exErr) throw exErr
  }

  return data
}

export async function updateWorkout(id, workout) {
  const { exercises, ...workoutData } = workout

  const { data, error } = await supabase
    .from('workouts')
    .update(workoutData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (Array.isArray(exercises)) {
    const { error: deleteErr } = await supabase
      .from('workout_exercises')
      .delete()
      .eq('workout_id', id)

    if (deleteErr) throw deleteErr

    if (exercises.length > 0) {
      const exRows = exercises.map((ex, i) => ({
        workout_id: id,
        exercise_name: ex.name || ex.exercise_name,
        exercise_id: ex.exercise_id || null,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds || parseRestToSeconds(ex.rest),
        weight_kg: parseWeightToKg(ex.weight_kg ?? ex.weightKg),
        notes: ex.notes?.trim() || null,
        order_index: i,
      }))

      const { error: exErr } = await supabase.from('workout_exercises').insert(exRows)
      if (exErr) throw exErr
    }
  }

  return data
}

export async function deleteWorkout(id) {
  const { error } = await supabase.from('workouts').delete().eq('id', id)
  if (error) throw error
}

// ─── WORKOUT LOGS ─────────────────────────────────────────────

export async function getWorkoutLogs(userId, limit = 10) {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*, workout_log_sets(*)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function createWorkoutLog(log) {
  const { sets, logMeta, ...logData } = log
  const notes = buildWorkoutLogNotes(logData.notes, logMeta)

  const payload = {
    ...logData,
    notes,
    load_level: logData.load_level ?? logMeta?.loadLevel ?? null,
    load_label: logData.load_label ?? logMeta?.loadLabel ?? null,
    completion_rate: logData.completion_rate ?? logMeta?.completionRate ?? null,
    completed_sets: logData.completed_sets ?? logMeta?.completedSets ?? null,
    total_sets: logData.total_sets ?? logMeta?.totalSets ?? null,
    session_load: logData.session_load ?? logMeta?.sessionLoad ?? null,
    finished_at: new Date().toISOString(),
  }

  let data
  let error

  ;({ data, error } = await supabase
    .from('workout_logs')
    .insert(payload)
    .select()
    .single())

  if (error) {
    const maybeMissingColumn =
      String(error.message || '').toLowerCase().includes('column') &&
      String(error.message || '').toLowerCase().includes('does not exist')

    if (!maybeMissingColumn) throw error

    // Fallback para bancos sem migração aplicada: mantém metadados no campo notes.
    ;({ data, error } = await supabase
      .from('workout_logs')
      .insert({ ...logData, notes, finished_at: new Date().toISOString() })
      .select()
      .single())

    if (error) throw error
  }

  if (sets?.length) {
    const setRows = sets.map(s => ({ ...s, log_id: data.id }))
    await supabase.from('workout_log_sets').insert(setRows)
  }
  return data
}

export async function getWeeklyWorkoutStats(userId) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const { data, error } = await supabase
    .from('workout_logs')
    .select('started_at, duration_seconds, calories_burned')
    .eq('user_id', userId)
    .gte('started_at', sevenDaysAgo.toISOString())
    .not('finished_at', 'is', null)
  if (error) throw error

  // Agrupa por dia da semana (últimos 7 dias)
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const result = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      day: days[d.getDay()],
      date: d.toDateString(),
      workouts: 0,
      minutes: 0,
      calories: 0
    }
  })

  ;(data || []).forEach(log => {
    const logDate = new Date(log.started_at).toDateString()
    const found = result.find(r => r.date === logDate)
    if (found) {
      found.workouts += 1
      found.minutes += Math.round((log.duration_seconds || 0) / 60)
      found.calories += log.calories_burned || 0
    }
  })
  return result
}

// ─── BODY MEASUREMENTS ────────────────────────────────────────

export async function getMeasurements(userId, limit = 20) {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('measured_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function createMeasurement(measurement) {
  const { data, error } = await supabase
    .from('body_measurements')
    .insert(measurement)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── CHAT MESSAGES ────────────────────────────────────────────

export async function getChatMessages(userId, limit = 50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function saveChatMessage(userId, role, content) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ user_id: userId, role, content })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function clearChatMessages(userId) {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}

// ─── SAVED AI RESPONSES ──────────────────────────────────────

export async function getSavedAIResponses(userId, responseType = null, limit = 50) {
  let query = supabase
    .from('saved_ai_responses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (responseType) {
    query = query.eq('response_type', responseType)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function saveAIResponse(response) {
  const { data, error } = await supabase
    .from('saved_ai_responses')
    .insert(response)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAIResponse(id) {
  const { error } = await supabase
    .from('saved_ai_responses')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── SAVED EXERCISES ──────────────────────────────────────────

export async function getSavedExercises(userId) {
  const { data, error } = await supabase
    .from('saved_exercises')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveExercise(userId, exercise) {
  const { data, error } = await supabase
    .from('saved_exercises')
    .upsert({ user_id: userId, ...exercise }, { onConflict: 'user_id,exercise_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function unsaveExercise(userId, exerciseId) {
  const { error } = await supabase
    .from('saved_exercises')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
  if (error) throw error
}

// ─── HELPERS ──────────────────────────────────────────────────

function parseRestToSeconds(rest) {
  if (!rest) return 60
  const match = String(rest).match(/(\d+)/)
  return match ? parseInt(match[1]) : 60
}

function parseWeightToKg(weight) {
  if (weight === null || weight === undefined || weight === '') return null
  const parsed = parseFloat(String(weight).replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

