import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Trash2, Play, Clock, Dumbbell, ChevronDown, ChevronUp,
  Zap, Copy, Star, CheckCircle2, X, Save
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { generateWorkoutPlan } from '../services/groqApi'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { getWorkouts, createWorkout, deleteWorkout, createWorkoutLog, getWorkoutLogs, parseWorkoutLogMeta } from '../services/dbService'

const EXERCISE_META_PREFIX = '__JPFITNESS_META__'

const TEMPLATES = [
  {
    id: 1,
    name: 'Dia de Empurrar (Peito + Ombros + Tríceps)',
    level: 'Intermediário',
    duration: '55 min',
    emoji: '💪',
    exercises: [
      { name: 'Supino Reto com Barra', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Supino Inclinado com Halteres', sets: 3, reps: '10-12', rest: '75s' },
      { name: 'Desenvolvimento com Barra', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Elevação Lateral', sets: 3, reps: '12-15', rest: '60s' },
      { name: 'Tríceps Corda', sets: 3, reps: '12-15', rest: '60s' },
      { name: 'Tríceps Francês', sets: 3, reps: '10-12', rest: '75s' },
    ]
  },
  {
    id: 2,
    name: 'Dia de Puxar (Costas + Bíceps)',
    level: 'Intermediário',
    duration: '50 min',
    emoji: '🏋️',
    exercises: [
      { name: 'Barra Fixa', sets: 4, reps: '6-8', rest: '90s' },
      { name: 'Remada Curvada', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Puxada Frontal', sets: 3, reps: '10-12', rest: '75s' },
      { name: 'Remada Unilateral', sets: 3, reps: '10-12', rest: '75s' },
      { name: 'Rosca Direta', sets: 3, reps: '10-12', rest: '60s' },
      { name: 'Rosca Martelo', sets: 3, reps: '12-15', rest: '60s' },
    ]
  },
  {
    id: 3,
    name: 'Dia de Pernas (Quadríceps + Posterior + Glúteos)',
    level: 'Avançado',
    duration: '70 min',
    emoji: '🦵',
    exercises: [
      { name: 'Agachamento Livre', sets: 5, reps: '6-8', rest: '120s' },
      { name: 'Leg Press 45°', sets: 4, reps: '10-12', rest: '90s' },
      { name: 'Stiff', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Cadeira Extensora', sets: 3, reps: '12-15', rest: '60s' },
      { name: 'Mesa Flexora', sets: 3, reps: '12-15', rest: '60s' },
      { name: 'Elevação Pélvica', sets: 4, reps: '12-15', rest: '75s' },
      { name: 'Panturrilha em Pé', sets: 4, reps: '15-20', rest: '45s' },
    ]
  },
  {
    id: 4,
    name: 'Corpo Inteiro para Iniciantes',
    level: 'Iniciante',
    duration: '40 min',
    emoji: '🌟',
    exercises: [
      { name: 'Agachamento com Peso Corporal', sets: 3, reps: '15', rest: '60s' },
      { name: 'Flexão de Braço', sets: 3, reps: '10-12', rest: '60s' },
      { name: 'Remada com Elástico', sets: 3, reps: '15', rest: '60s' },
      { name: 'Afundo', sets: 3, reps: '12 cada', rest: '60s' },
      { name: 'Prancha', sets: 3, reps: '30s', rest: '45s' },
    ]
  },
]

const LEVELS = ['Iniciante', 'Intermediário', 'Avançado']
const GOALS_LIST = ['Ganho de massa muscular', 'Perda de gordura', 'Força máxima', 'Resistência', 'Condicionamento geral']
const EQUIPMENT_OPTIONS = ['Academia completa', 'Halteres e barras', 'Apenas peso corporal', 'Elásticos e kettlebells']
const WEEK_SESSIONS = [
  { id: 's1', label: 'Sessão 1' },
  { id: 's2', label: 'Sessão 2' },
  { id: 's3', label: 'Sessão 3' },
  { id: 's4', label: 'Sessão 4' },
  { id: 's5', label: 'Sessão 5' },
  { id: 's6', label: 'Sessão 6' },
]

const LEVEL_TO_DB = {
  Iniciante: 'beginner',
  Intermediário: 'intermediate',
  Avançado: 'advanced',
}

const DB_TO_LEVEL = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
}

const CARDIO_TYPES = [
  { id: 'run', label: 'Corrida', emoji: '🏃' },
  { id: 'walk', label: 'Caminhada', emoji: '🚶' },
  { id: 'bike', label: 'Bicicleta', emoji: '🚴' },
]

function createEmptyExercise() {
  return {
    name: '',
    sets: 3,
    reps: '10-12',
    rest: '60s',
    notes: '',
  }
}

function getInitialManualBySession() {
  return WEEK_SESSIONS.reduce((acc, session) => {
    acc[session.id] = [createEmptyExercise()]
    return acc
  }, {})
}

function getSelectedSessions(timesPerWeek) {
  const total = Math.max(1, Math.min(6, Number(timesPerWeek) || 1))
  return WEEK_SESSIONS.slice(0, total).map(s => s.id)
}

function parseExerciseMeta(notes) {
  if (!notes) {
    return { notes: '' }
  }

  if (typeof notes === 'string' && notes.startsWith(EXERCISE_META_PREFIX)) {
    try {
      const parsed = JSON.parse(notes.slice(EXERCISE_META_PREFIX.length))
      return {
        notes: parsed?.notes || '',
      }
    } catch {
      return { notes: '' }
    }
  }

  return { notes }
}

function normalizeWorkout(workout) {
  return {
    ...workout,
    level: DB_TO_LEVEL[workout.level] || workout.level || 'Intermediário',
    duration: workout.estimated_duration_min ? `${workout.estimated_duration_min} min` : '45 min',
    exercises: (workout.workout_exercises || workout.exercises || []).map(ex => {
      const meta = parseExerciseMeta(ex.notes)
      return {
        name: ex.exercise_name || ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest_seconds ? `${ex.rest_seconds}s` : (ex.rest || '60s'),
        notes: meta.notes,
      }
    }),
  }
}

function estimateWorkoutDuration(exercises) {
  const totalMinutes = exercises.reduce((sum, ex) => {
    const rest = parseInt(String(ex.rest || '').replace(/[^\d]/g, ''), 10) || 60
    const sets = Number(ex.sets) || 3
    const workPerSet = 45
    return sum + ((sets * (workPerSet + rest)) / 60)
  }, 0)

  return Math.max(20, Math.round(totalMinutes))
}

function parseTargetReps(value) {
  const match = String(value || '').match(/\d+/)
  return match ? Number(match[0]) : null
}

function parseExerciseLine(line) {
  const clean = line
    .replace(/^[-*+•]\s*/, '')
    .replace(/\*\*/g, '')
    .trim()

  if (!clean) return null

  const detailed = clean.match(/^(.+?)\s*[:\-]\s*(\d+)\s*s[eé]ries?\s*(?:de)?\s*([\d\-xX ]+)\s*repet/i)
  if (detailed) {
    return {
      name: detailed[1].trim(),
      sets: Number(detailed[2]) || 3,
      reps: detailed[3].trim().replace(/\s+/g, ''),
      rest: '60s',
      notes: '',
    }
  }

  return {
    name: clean,
    sets: 3,
    reps: '10-12',
    rest: '60s',
    notes: '',
  }
}

function generateLocalWorkoutPlanText({ goal, days }) {
  const count = Math.max(1, Math.min(6, Number(days) || 3))

  const goalLower = String(goal || '').toLowerCase()
  const focus = goalLower.includes('gordura')
    ? ['Cardio intervalado', 'Circuito metabólico', 'Full body']
    : goalLower.includes('força')
      ? ['Força membros superiores', 'Força membros inferiores', 'Core e estabilidade']
      : ['Peito, ombros e tríceps', 'Costas e bíceps', 'Pernas e glúteos']

  const banks = [
    ['Agachamento Livre', 'Supino Reto', 'Remada Curvada', 'Desenvolvimento Militar', 'Prancha'],
    ['Leg Press', 'Puxada Frontal', 'Afundo', 'Elevação Lateral', 'Rosca Direta'],
    ['Stiff', 'Flexão de Braço', 'Remada Unilateral', 'Tríceps Corda', 'Abdominal Bicicleta'],
    ['Passada Caminhando', 'Puxada na Barra', 'Supino Inclinado', 'Panturrilha em Pé', 'Prancha Lateral'],
    ['Levantamento Terra Romeno', 'Paralela', 'Remada Baixa', 'Desenvolvimento com Halteres', 'Abdominal Infra'],
    ['Agachamento Sumô', 'Pulldown', 'Crucifixo Inclinado', 'Tríceps Francês', 'Mountain Climbers'],
  ]

  const blocks = []
  for (let i = 0; i < count; i += 1) {
    const title = focus[i % focus.length]
    const exercises = banks[i % banks.length]
    blocks.push([
      `Sessão ${i + 1}: ${title}`,
      ...exercises.map(ex => `- ${ex}: 3 séries de 10-12 repetições`),
      ''
    ].join('\n'))
  }

  return blocks.join('\n')
}

function parseAIPlanToWorkouts({ aiPlan, aiForm, userId, planName }) {
  const lines = (aiPlan || '').split('\n').map(l => l.trim()).filter(Boolean)
  const blockRegex = /(?:dia|sess[aã]o|treino)\s*(\d+)\s*[:\-]?\s*(.*)$/i
  const blocks = []
  let current = null

  for (const raw of lines) {
    const line = raw.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
    const blockMatch = line.match(blockRegex)

    if (blockMatch) {
      current = {
        dayNumber: blockMatch[1],
        title: blockMatch[2]?.trim() || `Sessão ${blockMatch[1]}`,
        exercises: [],
      }
      blocks.push(current)
      continue
    }

    const looksLikeExercise = /^[-*+•]/.test(raw) || /s[eé]ries?/i.test(line)
    if (!looksLikeExercise) continue

    const parsed = parseExerciseLine(raw)
    if (!parsed) continue

    if (!current) {
      current = { dayNumber: '1', title: 'Treino', exercises: [] }
      blocks.push(current)
    }

    current.exercises.push(parsed)
  }

  const parsedBlocks = blocks.filter(b => b.exercises.length > 0)
  if (parsedBlocks.length === 0) return []

  const targetSessions = Math.max(1, Number(aiForm.days) || 1)
  const allExercises = parsedBlocks.flatMap(b => b.exercises)

  let normalized = parsedBlocks

  if (targetSessions > 1 && parsedBlocks.length !== targetSessions && allExercises.length >= targetSessions) {
    const generated = []
    let cursor = 0

    for (let i = 0; i < targetSessions; i += 1) {
      const remainingExercises = allExercises.length - cursor
      const remainingBlocks = targetSessions - i
      const chunkSize = Math.ceil(remainingExercises / remainingBlocks)
      const chunk = allExercises.slice(cursor, cursor + chunkSize)
      cursor += chunkSize

      if (chunk.length > 0) {
        generated.push({
          dayNumber: String(i + 1),
          title: `Sessão ${i + 1}`,
          exercises: chunk,
        })
      }
    }

    normalized = generated
  }

  const levelDb = LEVEL_TO_DB[aiForm.level] || 'intermediate'

  return normalized.map((block, idx) => {
    const name = normalized.length > 1
      ? `${planName} • Sessão ${idx + 1}: ${block.title}`
      : planName

    return {
      user_id: userId,
      name,
      description: `Plano gerado por IA - ${aiForm.goal}`,
      emoji: '⚡',
      level: levelDb,
      estimated_duration_min: estimateWorkoutDuration(block.exercises),
      is_custom: true,
      tags: ['ai', `dias:${aiForm.days}`, `vezes:${aiForm.days}`, `bloco:${idx + 1}`],
      exercises: block.exercises,
    }
  })
}

function parseWorkoutIdentity(name = '') {
  const parts = String(name).split('•').map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return {
      programName: parts[0],
      sessionName: parts.slice(1).join(' • '),
    }
  }

  const sessionMatch = String(name).match(/((?:dia|sess[aã]o)\s*\d+[:\-]?.*)$/i)
  if (sessionMatch) {
    const base = String(name).replace(sessionMatch[0], '').replace(/[\-•:]\s*$/, '').trim()
    return {
      programName: base || String(name),
      sessionName: sessionMatch[1],
    }
  }

  return { programName: String(name), sessionName: '' }
}

function getProgramType(workouts = []) {
  const tags = workouts.flatMap(w => w.tags || [])
  if (tags.some(t => String(t).startsWith('estilo:'))) return 'Manual'
  if (tags.some(t => String(t).startsWith('dias:')) || tags.includes('ai')) return 'IA'
  return 'Modelo'
}

function getLoadStatsFromLog(log) {
  const sets = log?.workout_log_sets || []
  if (sets.length > 0) {
    const tracked = sets.filter(s => Number(s?.weight_kg || 0) > 0)
    const maxWeight = tracked.reduce((max, s) => Math.max(max, Number(s.weight_kg || 0)), 0)
    const sessionVolume = tracked.reduce((sum, s) => {
      const w = Number(s.weight_kg || 0)
      const r = Number(s.reps_completed || 0)
      return sum + (w * r)
    }, 0)

    return {
      maxWeight,
      sessionVolume,
      trackedSets: tracked.length,
    }
  }

  const { meta } = parseWorkoutLogMeta(log?.notes)
  return {
    maxWeight: Number(meta?.maxWeightKg || 0),
    sessionVolume: Number(log?.session_load || meta?.sessionLoad || 0),
    trackedSets: 0,
  }
}

function estimateCardioCalories(type, durationMin, distanceKm, weightKg) {
  const minutes = Number(durationMin || 0)
  const distance = Number(distanceKm || 0)
  const weight = Number(weightKg || 0)

  if (minutes <= 0 || distance <= 0 || weight <= 0) {
    return { calories: 0, met: 0, speedKmh: 0, paceMinKm: 0 }
  }

  const speedKmh = distance / (minutes / 60)
  const paceMinKm = minutes / distance

  let met = 5

  if (type === 'run') {
    if (paceMinKm <= 5) met = 11.5
    else if (paceMinKm <= 6) met = 10
    else if (paceMinKm <= 7) met = 8.8
    else met = 7.5
  } else if (type === 'walk') {
    if (paceMinKm <= 8) met = 5
    else if (paceMinKm <= 9.5) met = 4.3
    else if (paceMinKm <= 11) met = 3.5
    else met = 2.8
  } else if (type === 'bike') {
    if (speedKmh < 16) met = 4
    else if (speedKmh < 19) met = 6.8
    else if (speedKmh < 22) met = 8
    else met = 10
  }

  const calories = (met * 3.5 * weight / 200) * minutes
  return { calories, met, speedKmh, paceMinKm }
}

function WorkoutCard({ workout, onStart, onDelete, onCopy }) {
  const [expanded, setExpanded] = useState(false)
  const displayName = workout.sessionName || workout.name

  return (
    <div className="card flex flex-col overflow-hidden p-3 sm:p-3.5">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base">{workout.emoji || '💪'}</span>
          <div className="min-w-0 space-y-1.5">
            <h3 className="text-white font-medium text-[14px] sm:text-[15px] leading-tight line-clamp-1 break-words">{displayName}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`badge text-xs ${
                workout.level === 'Iniciante' ? 'bg-green-400/20 text-green-400' :
                workout.level === 'Intermediário' ? 'bg-yellow-400/20 text-yellow-400' :
                'bg-red-400/20 text-red-400'
              }`}>{workout.level}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge-dark flex items-center gap-1">
                <Clock size={10} />
                {workout.duration}
              </span>
              <span className="badge-dark">
                {workout.exercises.length} exercícios
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onCopy && (
            <button
              onClick={onCopy}
              className="hidden sm:inline-flex items-center gap-1 text-jp-gray hover:text-jp-orange text-xs transition-colors bg-jp-card-light px-2 py-1 rounded-lg border border-jp-border"
            >
              <Copy size={11} />
              Copiar
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-jp-gray hover:text-white rounded-lg hover:bg-jp-border transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(workout.id)}
              className="p-2 text-jp-gray hover:text-red-400 rounded-lg hover:bg-jp-border transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-jp-border pt-2.5 mt-1.5 space-y-1.5">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="py-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-jp-orange/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-jp-orange text-xs font-medium">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{ex.name}</p>
                </div>
                <div className="flex gap-3 text-xs text-jp-gray flex-shrink-0">
                  <span className="text-jp-orange font-semibold">{ex.sets}x{ex.reps}</span>
                  <span>⏱ {ex.rest}</span>
                </div>
              </div>

              {ex.notes && (
                <div className="ml-9 mt-2 space-y-1.5">
                  {ex.notes && <p className="text-xs text-jp-gray-light">{ex.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        {onCopy && (
          <button
            onClick={onCopy}
            className="sm:hidden inline-flex items-center justify-center w-9 h-8 rounded-lg border border-jp-orange/60 text-jp-orange bg-transparent hover:bg-jp-orange/10 transition-colors"
            aria-label="Copiar treino"
          >
            <Copy size={13} />
          </button>
        )}
        <button
          onClick={() => onStart(workout)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg bg-jp-orange hover:bg-jp-orange-dark text-white text-[12px] font-medium transition-colors whitespace-nowrap"
        >
          <Play size={13} />
          <span>Iniciar</span>
        </button>
      </div>
    </div>
  )
}

function ActiveWorkout({ workout, onFinish, onBack }) {
  const [completedSets, setCompletedSets] = useState({})
  const [setDetails, setSetDetails] = useState({})
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets, 0)
  const completedCount = Object.values(completedSets).flat().length
  const progress = Math.round((completedCount / totalSets) * 100)

  const getSetKey = (exIndex, setIndex) => `${exIndex}-${setIndex}`

  const updateSetDetail = (exIndex, setIndex, field, value) => {
    const key = getSetKey(exIndex, setIndex)
    setSetDetails(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }))
  }

  const buildPerformedSets = () => {
    const rows = []

    workout.exercises.forEach((ex, exIndex) => {
      const doneSets = completedSets[`${exIndex}`] || []

      doneSets.forEach(setIndex => {
        const key = getSetKey(exIndex, setIndex)
        const detail = setDetails[key] || {}
        const parsedWeight = detail.weightKg ? parseFloat(detail.weightKg) : null
        const parsedReps = detail.repsCompleted ? parseInt(detail.repsCompleted, 10) : null

        rows.push({
          exercise_name: ex.name,
          set_number: setIndex + 1,
          reps_completed: Number.isFinite(parsedReps) ? parsedReps : parseTargetReps(ex.reps),
          weight_kg: Number.isFinite(parsedWeight) ? parsedWeight : null,
          completed: true,
        })
      })
    })

    return rows
  }

  const performedSets = buildPerformedSets()
  const totalVolume = performedSets.reduce((sum, row) => {
    const w = Number(row.weight_kg || 0)
    const r = Number(row.reps_completed || 0)
    return sum + (w * r)
  }, 0)
  const maxWeight = performedSets.reduce((max, row) => Math.max(max, Number(row.weight_kg || 0)), 0)

  const toggleSet = (exIndex, setIndex) => {
    setCompletedSets(prev => {
      const key = `${exIndex}`
      const sets = prev[key] || []
      if (sets.includes(setIndex)) {
        return { ...prev, [key]: sets.filter(s => s !== setIndex) }
      }
      return { ...prev, [key]: [...sets, setIndex] }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-jp-black overflow-y-auto overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col gap-2 mb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-medium text-white leading-tight break-words">{workout.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-jp-gray text-xs sm:text-sm">
              <span className="flex items-center gap-1 text-jp-orange">
                <Clock size={14} /> {formatTime(elapsedSeconds)}
              </span>
              <span>{progress}% concluído</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 w-full sm:flex sm:items-center sm:gap-2">
            <button
              onClick={onBack}
              className="w-full inline-flex items-center justify-center h-8 px-2 rounded-lg border border-jp-orange/60 text-jp-orange bg-transparent hover:bg-jp-orange/10 text-[12px] font-medium transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={() => onFinish(elapsedSeconds, {
                sets: performedSets,
                completedSets: completedCount,
                totalSets,
                completionRate: totalSets ? Math.round((completedCount / totalSets) * 100) : 0,
                sessionLoad: Math.round(totalVolume * 100) / 100,
                maxWeightKg: maxWeight,
              })}
              className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg bg-jp-orange hover:bg-jp-orange-dark text-white text-[12px] font-medium transition-colors"
            >
              <CheckCircle2 size={13} />
              Finalizar
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-jp-border rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-gradient-orange rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="card mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
              <p className="text-xs text-jp-gray mb-1">Séries concluídas</p>
              <p className="text-white font-semibold text-lg">{completedCount}/{totalSets}</p>
            </div>
            <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
              <p className="text-xs text-jp-gray mb-1">Maior carga</p>
              <p className="text-white font-semibold text-lg">{maxWeight > 0 ? `${maxWeight.toFixed(1)} kg` : '—'}</p>
            </div>
            <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
              <p className="text-xs text-jp-gray mb-1">Volume da sessão</p>
              <p className="text-white font-semibold text-lg">{totalVolume > 0 ? `${Math.round(totalVolume)} kg-reps` : '—'}</p>
            </div>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-3">
          {workout.exercises.map((ex, exIndex) => {
            const exCompleted = completedSets[`${exIndex}`] || []
            const allDone = exCompleted.length === ex.sets

            return (
              <div key={exIndex} className={`card transition-all duration-300 ${allDone ? 'border-green-400/40 bg-green-400/5' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-jp-gray">Exercício {exIndex + 1}/{workout.exercises.length}</span>
                      {allDone && <CheckCircle2 size={14} className="text-green-400" />}
                    </div>
                    <h3 className="text-white font-semibold text-base sm:text-base leading-tight">{ex.name}</h3>
                    <p className="text-jp-gray text-xs sm:text-sm">{ex.reps} repetições • Descanso: {ex.rest}</p>
                  </div>
                </div>

                {/* Sets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Array.from({ length: ex.sets }, (_, setIndex) => {
                    const done = exCompleted.includes(setIndex)
                    const key = getSetKey(exIndex, setIndex)
                    const detail = setDetails[key] || {}

                    return (
                      <div key={setIndex} className="rounded-xl border border-jp-border bg-jp-card-light p-2">
                        <button
                          onClick={() => toggleSet(exIndex, setIndex)}
                          className={`w-full h-8 rounded-lg border font-medium text-xs sm:text-sm transition-all duration-200 ${
                            done
                              ? 'bg-jp-orange border-jp-orange text-white shadow-orange'
                              : 'bg-jp-card border-jp-border text-jp-gray hover:border-jp-orange/50 hover:text-white'
                          }`}
                        >
                          {done ? `✓ ${setIndex + 1}ª` : `${setIndex + 1}ª série`}
                        </button>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={detail.weightKg || ''}
                            onChange={e => updateSetDetail(exIndex, setIndex, 'weightKg', e.target.value)}
                            placeholder="kg"
                            className="input-dark py-2 text-xs"
                          />
                          <input
                            type="number"
                            min="0"
                            value={detail.repsCompleted || ''}
                            onChange={e => updateSetDetail(exIndex, setIndex, 'repsCompleted', e.target.value)}
                            placeholder="reps"
                            className="input-dark py-2 text-xs"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Workouts() {
  const { user, profile, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('templates')
  const [myWorkouts, setMyWorkouts] = useState([])
  const [activeWorkout, setActiveWorkout] = useState(null)
  const [workoutsLoading, setWorkoutsLoading] = useState(false)
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showManualBuilder, setShowManualBuilder] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualForm, setManualForm] = useState({
    name: '',
    style: 'Hipertrofia',
    level: 'Intermediário',
    daysPerWeek: '5',
    byDay: getInitialManualBySession(),
  })
  const [aiForm, setAiForm] = useState({ level: 'Intermediário', goal: GOALS_LIST[0], days: '3', equipment: EQUIPMENT_OPTIONS[0] })
  const [aiPlan, setAiPlan] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiPlanName, setAiPlanName] = useState('')
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [cardioSaving, setCardioSaving] = useState(false)
  const [cardioExpanded, setCardioExpanded] = useState(true)
  const [expandedPrograms, setExpandedPrograms] = useState({})
  const [cardioFeedback, setCardioFeedback] = useState(null)
  const [cardioForm, setCardioForm] = useState({
    type: 'run',
    durationMin: '20',
    distanceKm: '3',
    weightKg: '',
  })

  const loadWorkouts = async () => {
    if (!user?.id) {
      setMyWorkouts([])
      return
    }
    setWorkoutsLoading(true)
    try {
      const data = await getWorkouts(user.id)
      setMyWorkouts((data || []).map(normalizeWorkout))
    } catch (err) {
      console.error(err)
    } finally {
      setWorkoutsLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) loadWorkouts()
  }, [user?.id, authLoading])

  useEffect(() => {
    const profileWeight = Number(profile?.weight_kg || 0)
    if (profileWeight > 0) {
      setCardioForm(prev => prev.weightKg ? prev : { ...prev, weightKg: String(profileWeight) })
    }
  }, [profile?.weight_kg])

  const loadLogs = async () => {
    if (!user?.id) {
      setWorkoutLogs([])
      return
    }

    setLogsLoading(true)
    try {
      const logs = await getWorkoutLogs(user.id, 30)
      setWorkoutLogs(logs || [])
    } catch (err) {
      console.error(err)
      setWorkoutLogs([])
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`workouts-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workouts', filter: `user_id=eq.${user.id}` },
        () => loadWorkouts()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') loadWorkouts()
    }
    const handleFocus = () => loadWorkouts()
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user?.id])

  const groupedPrograms = useMemo(() => {
    const map = new Map()
    for (const workout of myWorkouts) {
      const { programName, sessionName } = parseWorkoutIdentity(workout.name)
      const key = programName.toLowerCase().trim()
      if (!map.has(key)) {
        map.set(key, {
          name: programName,
          workouts: [],
        })
      }
      map.get(key).workouts.push({ ...workout, sessionName })
    }

    const groups = Array.from(map.values()).map(group => {
      const totalExercises = group.workouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0)
      return {
        ...group,
        weeklyCount: group.workouts.length,
        totalExercises,
        type: getProgramType(group.workouts),
      }
    })

    return groups.sort((a, b) => b.weeklyCount - a.weeklyCount)
  }, [myWorkouts])

  useEffect(() => {
    if (groupedPrograms.length === 0) {
      setExpandedPrograms({})
      return
    }

    setExpandedPrograms(prev => {
      const next = {}
      groupedPrograms.forEach(program => {
        const key = program.name.toLowerCase().trim()
        next[key] = Object.prototype.hasOwnProperty.call(prev, key) ? prev[key] : true
      })
      return next
    })
  }, [groupedPrograms])

  const cardioPanel = useMemo(() => {
    const cardioLogs = workoutLogs.filter(log => {
      const { meta } = parseWorkoutLogMeta(log?.notes)
      return meta?.sessionType === 'cardio' || String(log?.name || '').toLowerCase().startsWith('cardio:')
    })

    const totals = cardioLogs.reduce((acc, log) => {
      const { meta } = parseWorkoutLogMeta(log?.notes)
      const type = meta?.cardioType || 'run'
      const distanceKm = Number(meta?.distanceKm || 0)
      const durationMin = Number(meta?.durationMin || log?.duration_seconds / 60 || 0)
      const calories = Number(log?.calories_burned || meta?.estimatedCalories || 0)

      acc.totalSessions += 1
      acc.totalDistanceKm += distanceKm
      acc.totalDurationMin += durationMin
      acc.totalCalories += calories
      acc.byType[type] = (acc.byType[type] || 0) + 1
      return acc
    }, {
      totalSessions: 0,
      totalDistanceKm: 0,
      totalDurationMin: 0,
      totalCalories: 0,
      byType: { run: 0, walk: 0, bike: 0 }
    })

    const recent = cardioLogs.slice(0, 5).map(log => {
      const { meta } = parseWorkoutLogMeta(log?.notes)
      const type = meta?.cardioType || 'run'
      const typeLabel = CARDIO_TYPES.find(t => t.id === type)?.label || 'Cardio'
      const distanceKm = Number(meta?.distanceKm || 0)
      const durationMin = Math.max(1, Math.round(Number(meta?.durationMin || log?.duration_seconds / 60 || 0)))
      const calories = Number(log?.calories_burned || meta?.estimatedCalories || 0)
      return {
        id: log.id,
        name: typeLabel,
        when: log?.started_at
          ? new Date(log.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '--/--',
        durationMin,
        distanceKm,
        calories,
      }
    })

    return {
      ...totals,
      recent,
    }
  }, [workoutLogs])

  const handleSaveCardio = async () => {
    if (!user?.id) {
      alert('Você precisa estar logado para registrar cardio.')
      return
    }

    const durationMin = Number(cardioForm.durationMin || 0)
    const distanceKm = Number(cardioForm.distanceKm || 0)
    const weightKg = Number(cardioForm.weightKg || 0)

    if (durationMin <= 0 || distanceKm <= 0 || weightKg <= 0) {
      alert('Preencha tempo, distância e peso com valores válidos.')
      return
    }

    const calc = estimateCardioCalories(cardioForm.type, durationMin, distanceKm, weightKg)
    const typeLabel = CARDIO_TYPES.find(t => t.id === cardioForm.type)?.label || 'Cardio'
    const startedAt = new Date(Date.now() - durationMin * 60 * 1000).toISOString()

    setCardioSaving(true)
    try {
      await createWorkoutLog({
        user_id: user.id,
        workout_id: null,
        name: `Cardio: ${typeLabel}`,
        started_at: startedAt,
        duration_seconds: Math.round(durationMin * 60),
        calories_burned: Math.round(calc.calories),
        completion_rate: 100,
        logMeta: {
          sessionType: 'cardio',
          cardioType: cardioForm.type,
          distanceKm,
          durationMin,
          weightKg,
          estimatedCalories: Math.round(calc.calories),
          met: Number(calc.met.toFixed(1)),
          speedKmh: Number(calc.speedKmh.toFixed(1)),
          paceMinKm: Number(calc.paceMinKm.toFixed(1)),
          createdBy: 'workouts-cardio-module',
        },
      })

      setCardioFeedback({
        calories: Math.round(calc.calories),
        paceMinKm: calc.paceMinKm,
        speedKmh: calc.speedKmh,
      })
      await loadLogs()
      alert(`Cardio registrado! Estimativa de ${Math.round(calc.calories)} kcal.`)
    } catch (err) {
      console.error(err)
      alert(`Não foi possível registrar o cardio: ${err?.message || 'erro desconhecido'}`)
    } finally {
      setCardioSaving(false)
    }
  }

  const handleStartWorkout = (workout) => {
    setActiveWorkout(workout)
  }

  const handleFinishWorkout = async (durationSeconds, sessionMeta = null) => {
    if (user && activeWorkout) {
      const finishedAt = new Date().toISOString()
      await createWorkoutLog({
        user_id: user.id,
        workout_id: activeWorkout.id || null,
        name: activeWorkout.name,
        duration_seconds: durationSeconds || 0,
        started_at: new Date(Date.now() - (durationSeconds || 0) * 1000).toISOString(),
        finished_at: finishedAt,
        sets: sessionMeta?.sets || [],
        load_level: sessionMeta?.maxWeightKg ? Math.min(5, Math.max(1, Math.round(sessionMeta.maxWeightKg / 20))) : null,
        load_label: sessionMeta?.maxWeightKg ? `${sessionMeta.maxWeightKg.toFixed(1)}kg máx` : null,
        completion_rate: sessionMeta?.completionRate || null,
        completed_sets: sessionMeta?.completedSets || null,
        total_sets: sessionMeta?.totalSets || null,
        session_load: sessionMeta?.sessionLoad || null,
        logMeta: {
          ...(sessionMeta || {}),
          workoutLevel: activeWorkout.level,
          workoutName: activeWorkout.name,
          finishedAt,
        },
      }).catch(console.error)
    }
    setActiveWorkout(null)
    alert('✅ Treino concluído! Parabéns! 💪')
  }

  const handleBackFromWorkout = () => {
    const leave = window.confirm('Deseja voltar sem finalizar este treino agora?')
    if (leave) setActiveWorkout(null)
  }

  const handleDeleteMyWorkout = async (id) => {
    await deleteWorkout(id).catch(console.error)
    setMyWorkouts(prev => prev.filter(w => w.id !== id))
  }

  const handleCopyTemplate = async (template) => {
    const copy = {
      user_id: user?.id,
      name: `${template.name} (Cópia)`,
      level: LEVEL_TO_DB[template.level] || 'intermediate',
      estimated_duration_min: parseInt(template.duration, 10) || 45,
      emoji: template.emoji,
      is_custom: true,
      tags: ['manual', 'template'],
      exercises: template.exercises,
    }

    if (user) {
      const saved = await createWorkout(copy).catch(() => null)
      if (saved) {
        await loadWorkouts()
        setActiveTab('mine')
        return
      }
    }

    setMyWorkouts(prev => [...prev, normalizeWorkout({ ...copy, id: Date.now(), workout_exercises: copy.exercises })])
    setActiveTab('mine')
  }

  const handleGenerateAIPlan = async () => {
    setAiLoading(true)
    try {
      const plan = await generateWorkoutPlan(aiForm)
      setAiPlan(plan)
      if (!aiPlanName.trim()) {
        setAiPlanName(`Plano IA - ${aiForm.goal} (${aiForm.days}x semana)`)
      }
    } catch (err) {
      console.error(err)
      const fallback = generateLocalWorkoutPlanText(aiForm)
      setAiPlan(fallback)
      if (!aiPlanName.trim()) {
        setAiPlanName(`Plano Local - ${aiForm.goal} (${aiForm.days}x semana)`)
      }
      alert('IA indisponível no momento. Geramos um plano local para você continuar.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSaveAIPlan = async () => {
    if (!user) {
      alert('Você precisa estar logado para salvar treinos.')
      return
    }

    if (!aiPlan || /^erro ao gerar plano/i.test(aiPlan.trim())) {
      alert('Gere um plano válido com IA antes de salvar.')
      return
    }

    const name = aiPlanName.trim() || `Plano IA - ${aiForm.goal} (${aiForm.days}x semana)`
    const payloads = parseAIPlanToWorkouts({ aiPlan, aiForm, userId: user.id, planName: name })

    if (payloads.length === 0) {
      alert('Não consegui identificar exercícios no plano da IA. Tente gerar novamente.')
      return
    }

    setAiSaving(true)
    try {
      for (const payload of payloads) {
        await createWorkout(payload)
      }
      await loadWorkouts()
      setActiveTab('mine')
      alert(`Plano da IA salvo com sucesso! ${payloads.length} treino(s) criado(s).`)
    } catch (err) {
      console.error(err)
      alert(`Falha ao salvar plano da IA: ${err?.message || 'erro desconhecido'}`)
    } finally {
      setAiSaving(false)
    }
  }

  const addExerciseToDay = (dayId) => {
    setManualForm(prev => ({
      ...prev,
      byDay: {
        ...prev.byDay,
        [dayId]: [...prev.byDay[dayId], createEmptyExercise()]
      }
    }))
  }

  const updateExerciseField = (dayId, index, field, value) => {
    setManualForm(prev => ({
      ...prev,
      byDay: {
        ...prev.byDay,
        [dayId]: prev.byDay[dayId].map((ex, i) => i === index ? { ...ex, [field]: value } : ex)
      }
    }))
  }

  const removeExerciseFromDay = (dayId, index) => {
    setManualForm(prev => {
      const list = prev.byDay[dayId].filter((_, i) => i !== index)
      return {
        ...prev,
        byDay: {
          ...prev.byDay,
          [dayId]: list.length ? list : [createEmptyExercise()]
        }
      }
    })
  }

  const resetManualForm = () => {
    setManualForm({
      name: '',
      style: 'Hipertrofia',
      level: 'Intermediário',
      daysPerWeek: '5',
      byDay: getInitialManualBySession(),
    })
  }

  const handleSaveManualPlan = async () => {
    if (!user) {
      alert('Você precisa estar logado para salvar treinos.')
      return
    }
    if (!manualForm.name.trim()) {
      alert('Informe um nome para o plano semanal.')
      return
    }
    const selectedSessions = getSelectedSessions(manualForm.daysPerWeek)
    if (selectedSessions.length === 0) {
      alert('Selecione quantas vezes por semana você quer treinar.')
      return
    }

    setManualSaving(true)
    let createdCount = 0

    try {
      for (const dayId of selectedSessions) {
        const dayLabel = WEEK_SESSIONS.find(d => d.id === dayId)?.label || dayId
        const exercises = (manualForm.byDay[dayId] || [])
          .map(ex => ({
            ...ex,
            name: ex.name.trim(),
            sets: Number(ex.sets) || 3,
            reps: ex.reps.trim() || '10',
            rest: ex.rest.trim() || '60s',
            notes: ex.notes.trim(),
          }))
          .filter(ex => ex.name)

        if (!exercises.length) continue

        const payload = {
          user_id: user.id,
          name: `${manualForm.name.trim()} • ${dayLabel}`,
          description: `Plano manual (${manualForm.style}) - ${dayLabel}`,
          emoji: '🗓️',
          level: LEVEL_TO_DB[manualForm.level] || 'intermediate',
          estimated_duration_min: estimateWorkoutDuration(exercises),
          is_custom: true,
          tags: ['manual', `estilo:${manualForm.style.toLowerCase()}`, `sessao:${dayId}`],
          exercises,
        }

        await createWorkout(payload)
        createdCount += 1
      }

      if (!createdCount) {
        alert('Preencha pelo menos 1 exercício válido em algum dia selecionado.')
        return
      }

      await loadWorkouts()
      setActiveTab('mine')
      setShowManualBuilder(false)
      resetManualForm()
      alert(`Plano semanal criado com sucesso! ${createdCount} sessão(ões) salva(s).`)
    } catch (err) {
      console.error(err)
      alert(`Não foi possível salvar o plano manual agora: ${err?.message || 'erro desconhecido'}`)
    } finally {
      setManualSaving(false)
    }
  }

  if (activeWorkout) {
    return <ActiveWorkout workout={activeWorkout} onFinish={handleFinishWorkout} onBack={handleBackFromWorkout} />
  }

  return (
    <div className="page-container !pt-28 sm:!pt-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-semibold text-white mb-0.5">Meus Treinos</h1>
          <p className="text-jp-gray text-sm sm:text-[15px]">Crie treinos por sessões semanais, use modelos ou IA</p>
        </div>
        <div className="grid grid-cols-2 w-full sm:w-auto gap-1.5">
          <button
            onClick={() => setShowManualBuilder(!showManualBuilder)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border border-jp-orange/60 text-jp-orange bg-transparent hover:bg-jp-orange/10 text-[12px] sm:text-[13px] font-medium transition-colors min-w-0"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Criar Manual</span>
            <span className="sm:hidden">Manual</span>
          </button>
          <button
            onClick={() => setShowAIGenerator(!showAIGenerator)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg bg-jp-orange hover:bg-jp-orange-dark text-white text-[12px] sm:text-[13px] font-medium transition-colors min-w-0"
          >
            <Zap size={13} />
            <span className="hidden sm:inline">Gerar com IA</span>
            <span className="sm:hidden">Gerar IA</span>
          </button>
        </div>
      </div>

      {/* Manual Builder */}
      {showManualBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowManualBuilder(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative bg-jp-card border border-blue-400/25 rounded-2xl max-w-5xl w-full max-h-[88vh] overflow-y-auto p-4 sm:p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-blue-400" />
                Montar Treino Manual (Semana)
              </h2>
              <button onClick={() => setShowManualBuilder(false)} className="text-jp-gray hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Nome do Plano</label>
                <input
                  value={manualForm.name}
                  onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: ABC Hipertrofia"
                  className="input-dark"
                />
              </div>
              <div>
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Estilo de Treino</label>
                <input
                  value={manualForm.style}
                  onChange={e => setManualForm(f => ({ ...f, style: e.target.value }))}
                  placeholder="Ex: Hipertrofia, Força, Corpo inteiro"
                  className="input-dark"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Nível</label>
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map(level => (
                  <button
                    key={level}
                    onClick={() => setManualForm(f => ({ ...f, level }))}
                    className={manualForm.level === level ? 'tab-btn-active' : 'tab-btn-inactive'}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Vezes por Semana</label>
              <div className="flex gap-2 flex-wrap">
                {['1', '2', '3', '4', '5', '6'].map(times => (
                  <button
                    key={times}
                    onClick={() => setManualForm(f => ({ ...f, daysPerWeek: times }))}
                    className={`px-3 py-2 rounded-xl border text-sm transition-colors min-w-0 ${
                      manualForm.daysPerWeek === times
                        ? 'bg-jp-orange border-jp-orange text-white font-semibold'
                        : 'bg-jp-card border-jp-border text-jp-gray hover:border-jp-orange/40'
                    }`}
                  >
                    {times}x
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {getSelectedSessions(manualForm.daysPerWeek).map(dayId => {
                const dayLabel = WEEK_SESSIONS.find(d => d.id === dayId)?.label || dayId
                const dayExercises = manualForm.byDay[dayId] || []

                return (
                  <div key={dayId} className="bg-jp-card-light border border-jp-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold">{dayLabel}</h3>
                      <button onClick={() => addExerciseToDay(dayId)} className="text-jp-orange text-sm hover:underline inline-flex items-center gap-1">
                        <Plus size={12} /> Adicionar exercício
                      </button>
                    </div>

                    <div className="space-y-3">
                      {dayExercises.map((ex, index) => (
                        <div key={`${dayId}-${index}`} className="border border-jp-border rounded-lg p-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
                            <input
                              value={ex.name}
                              onChange={e => updateExerciseField(dayId, index, 'name', e.target.value)}
                              placeholder="Nome do exercício"
                              className="input-dark sm:col-span-2"
                            />
                            <input
                              type="number"
                              min="1"
                              value={ex.sets}
                              onChange={e => updateExerciseField(dayId, index, 'sets', e.target.value)}
                              placeholder="Séries"
                              className="input-dark"
                            />
                            <input
                              value={ex.reps}
                              onChange={e => updateExerciseField(dayId, index, 'reps', e.target.value)}
                              placeholder="Repetições"
                              className="input-dark"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                            <input
                              value={ex.rest}
                              onChange={e => updateExerciseField(dayId, index, 'rest', e.target.value)}
                              placeholder="Descanso (ex: 60s)"
                              className="input-dark"
                            />
                            <div className="hidden sm:block" />
                          </div>

                          <div className="flex gap-2 items-start">
                            <textarea
                              value={ex.notes}
                              onChange={e => updateExerciseField(dayId, index, 'notes', e.target.value)}
                              placeholder="Observações/técnica do exercício"
                              className="input-dark min-h-[42px]"
                            />
                            <button
                              onClick={() => removeExerciseFromDay(dayId, index)}
                              className="p-2 text-jp-gray hover:text-red-400 rounded-lg hover:bg-jp-border transition-colors"
                              title="Remover exercício"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={handleSaveManualPlan}
                disabled={manualSaving}
                className="btn-primary w-full sm:w-auto disabled:opacity-40"
              >
                {manualSaving ? <><LoadingSpinner size="sm" /> Salvando...</> : <><Save size={16} /> Salvar Plano Manual</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generator */}
      {showAIGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAIGenerator(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative bg-jp-card border border-jp-orange/30 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap size={18} className="text-jp-orange" />
                Gerador de Plano com IA
              </h2>
              <button onClick={() => setShowAIGenerator(false)} className="text-jp-gray hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Nível</label>
                <div className="flex gap-2 flex-wrap">
                  {LEVELS.map(level => (
                    <button
                      key={level}
                      onClick={() => setAiForm(f => ({ ...f, level }))}
                      className={aiForm.level === level ? 'tab-btn-active' : 'tab-btn-inactive'}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Vezes por Semana</label>
                <div className="flex gap-2">
                  {['2', '3', '4', '5', '6'].map(d => (
                    <button
                      key={d}
                      onClick={() => setAiForm(f => ({ ...f, days: d }))}
                      className={`w-10 h-10 rounded-xl border font-bold text-sm transition-all ${
                        aiForm.days === d
                          ? 'bg-jp-orange border-jp-orange text-white'
                          : 'bg-jp-card border-jp-border text-jp-gray hover:border-jp-orange/40'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Objetivo</label>
                <select
                  value={aiForm.goal}
                  onChange={e => setAiForm(f => ({ ...f, goal: e.target.value }))}
                  className="input-dark"
                >
                  {GOALS_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Equipamento</label>
                <select
                  value={aiForm.equipment}
                  onChange={e => setAiForm(f => ({ ...f, equipment: e.target.value }))}
                  className="input-dark"
                >
                  {EQUIPMENT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateAIPlan}
              disabled={aiLoading}
              className="btn-primary w-full justify-center disabled:opacity-40"
            >
              {aiLoading ? <><LoadingSpinner size="sm" /> Gerando plano...</> : <><Zap size={16} /> Gerar Plano Personalizado</>}
            </button>

            {aiPlan && (
              <div className="mt-4 bg-jp-card-light border border-jp-border rounded-xl p-4 max-h-96 overflow-y-auto">
                <p className="text-xs font-semibold text-jp-orange uppercase tracking-wider mb-3">Plano Gerado pela IA</p>
                <pre className="text-sm text-jp-gray-light leading-relaxed whitespace-pre-wrap font-sans">{aiPlan}</pre>
              </div>
            )}

            {aiPlan && !/^erro ao gerar plano/i.test(aiPlan.trim()) && (
              <div className="mt-4 border border-jp-border rounded-xl p-4 bg-jp-card-light/40">
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Nome para salvar</label>
                <input
                  value={aiPlanName}
                  onChange={e => setAiPlanName(e.target.value)}
                  placeholder="Ex: Hipertrofia 3x semana"
                  className="input-dark mb-3"
                />
                <button
                  onClick={handleSaveAIPlan}
                  disabled={aiSaving}
                  className="btn-secondary w-full sm:w-auto disabled:opacity-40"
                >
                  {aiSaving ? <><LoadingSpinner size="sm" /> Salvando plano...</> : <><Save size={16} /> Salvar Plano da IA</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setActiveTab('templates')}
          className={`${activeTab === 'templates' ? 'tab-btn-active' : 'tab-btn-inactive'} py-1.5 text-[12px] sm:text-[13px]`}
        >
          <Star size={14} className="inline mr-1" />
          Modelos ({TEMPLATES.length})
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          className={`${activeTab === 'mine' ? 'tab-btn-active' : 'tab-btn-inactive'} py-1.5 text-[12px] sm:text-[13px]`}
        >
          <Dumbbell size={14} className="inline mr-1" />
          Meus Treinos ({myWorkouts.length})
        </button>
      </div>

      <section className="card p-3 sm:p-3.5 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-white font-semibold text-base sm:text-lg">Cardio</h2>
          <div className="flex items-center gap-2">
            <span className="badge-dark text-[11px] hidden sm:inline-flex">Corrida • Caminhada • Bicicleta</span>
            <button
              onClick={() => setCardioExpanded(prev => !prev)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-jp-border text-jp-gray hover:text-white hover:border-jp-orange/40 transition-colors"
              aria-label={cardioExpanded ? 'Retrair seção de cardio' : 'Expandir seção de cardio'}
              title={cardioExpanded ? 'Retrair' : 'Expandir'}
            >
              {cardioExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {cardioExpanded && (
        <>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-1">Tipo</label>
              <select
                value={cardioForm.type}
                onChange={e => setCardioForm(prev => ({ ...prev, type: e.target.value }))}
                className="input-dark py-2 text-sm"
              >
                {CARDIO_TYPES.map(item => (
                  <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-1">Tempo (min)</label>
              <input
                type="number"
                min="1"
                value={cardioForm.durationMin}
                onChange={e => setCardioForm(prev => ({ ...prev, durationMin: e.target.value }))}
                className="input-dark py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-1">Distância (km)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={cardioForm.distanceKm}
                onChange={e => setCardioForm(prev => ({ ...prev, distanceKm: e.target.value }))}
                className="input-dark py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-1">Peso (kg)</label>
              <input
                type="number"
                min="25"
                step="0.1"
                value={cardioForm.weightKg}
                onChange={e => setCardioForm(prev => ({ ...prev, weightKg: e.target.value }))}
                className="input-dark py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-jp-border bg-jp-card-light p-2.5">
            <p className="text-[11px] text-jp-gray uppercase tracking-wider font-semibold">Estimativa estilo esteira</p>
            {(() => {
              const preview = estimateCardioCalories(cardioForm.type, cardioForm.durationMin, cardioForm.distanceKm, cardioForm.weightKg)
              return (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-white font-semibold">{Math.round(preview.calories || 0)} kcal</p>
                  <p className="text-jp-gray">Velocidade: {preview.speedKmh > 0 ? `${preview.speedKmh.toFixed(1)} km/h` : '—'}</p>
                  <p className="text-jp-gray">Ritmo: {preview.paceMinKm > 0 ? `${preview.paceMinKm.toFixed(1)} min/km` : '—'}</p>
                </div>
              )
            })()}
            <button
              onClick={handleSaveCardio}
              disabled={cardioSaving}
              className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg bg-jp-orange hover:bg-jp-orange-dark text-white text-[12px] font-medium transition-colors disabled:opacity-50"
            >
              {cardioSaving ? <><LoadingSpinner size="sm" /> Salvando...</> : <><Save size={12} /> Registrar cardio</>}
            </button>
          </div>
        </div>

        {cardioFeedback && (
          <div className="mt-2 text-xs text-jp-gray">
            Último registro: {cardioFeedback.calories} kcal • {cardioFeedback.speedKmh.toFixed(1)} km/h • {cardioFeedback.paceMinKm.toFixed(1)} min/km
          </div>
        )}

        <div className="mt-3 pt-2.5 border-t border-jp-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
            <div className="rounded-lg border border-jp-border bg-jp-card-light p-2">
              <p className="text-[11px] text-jp-gray">Sessões cardio</p>
              <p className="text-white font-semibold text-base leading-tight">{cardioPanel.totalSessions}</p>
            </div>
            <div className="rounded-lg border border-jp-border bg-jp-card-light p-2">
              <p className="text-[11px] text-jp-gray">Distância total</p>
              <p className="text-white font-semibold text-base leading-tight">{cardioPanel.totalDistanceKm.toFixed(1)} km</p>
            </div>
            <div className="rounded-lg border border-jp-border bg-jp-card-light p-2">
              <p className="text-[11px] text-jp-gray">Tempo total</p>
              <p className="text-white font-semibold text-base leading-tight">{Math.round(cardioPanel.totalDurationMin)} min</p>
            </div>
            <div className="rounded-lg border border-jp-border bg-jp-card-light p-2">
              <p className="text-[11px] text-jp-gray">Calorias</p>
              <p className="text-white font-semibold text-base leading-tight">{Math.round(cardioPanel.totalCalories)} kcal</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="badge-dark">Corrida: {cardioPanel.byType.run || 0}</span>
            <span className="badge-dark">Caminhada: {cardioPanel.byType.walk || 0}</span>
            <span className="badge-dark">Bicicleta: {cardioPanel.byType.bike || 0}</span>
          </div>

          <div className="mt-2 space-y-1.5">
            <p className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold">Últimos cardios</p>
            {logsLoading ? (
              <div className="py-2"><LoadingSpinner size="sm" /></div>
            ) : cardioPanel.recent.length === 0 ? (
              <p className="text-jp-gray text-xs">Sem registros de cardio ainda.</p>
            ) : (
              cardioPanel.recent.map(item => (
                <div key={item.id} className="rounded-lg border border-jp-border bg-jp-card-light px-2 py-1.5">
                  <p className="text-white text-xs font-medium">{item.name}</p>
                  <p className="text-jp-gray text-[11px] mt-0.5">{item.when} • {item.distanceKm.toFixed(1)} km • {item.durationMin} min • {Math.round(item.calories)} kcal</p>
                </div>
              ))
            )}
          </div>
        </div>
        </>
        )}
      </section>

      {/* Templates */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {TEMPLATES.map(template => (
            <WorkoutCard
              key={template.id}
              workout={template}
              onStart={handleStartWorkout}
              onCopy={() => handleCopyTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* My workouts */}
      {activeTab === 'mine' && (
        workoutsLoading ? (
          <div className="py-16 flex justify-center"><LoadingSpinner text="Carregando treinos..." /></div>
        ) : myWorkouts.length === 0 ? (
          <div className="text-center py-16">
            <Dumbbell size={48} className="text-jp-border mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">Nenhum treino salvo ainda</h3>
            <p className="text-jp-gray mb-6">Crie manualmente por sessões semanais, copie um template ou use IA</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowManualBuilder(true)} className="btn-secondary">
                <Plus size={16} />
                Criar Manual
              </button>
              <button onClick={() => setShowAIGenerator(true)} className="btn-primary">
                <Zap size={16} />
                Gerar com IA
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedPrograms.map(program => {
              const programKey = program.name.toLowerCase().trim()
              const isProgramExpanded = expandedPrograms[programKey] ?? true

              return (
                <section key={program.name} className="card p-0 overflow-hidden">
                  <div className="px-3 sm:px-4 py-2.5 border-b border-jp-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <div>
                      <h3 className="text-white font-semibold text-[19px] leading-tight break-words">{program.name}</h3>
                      <p className="text-jp-gray text-[13px]">
                        {program.weeklyCount}x por semana • {program.totalExercises} exercícios no total
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 w-fit">
                      <span className="badge-dark text-xs w-fit">{program.type}</span>
                      <button
                        onClick={() => setExpandedPrograms(prev => ({ ...prev, [programKey]: !isProgramExpanded }))}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-jp-border text-jp-gray hover:text-white hover:border-jp-orange/40 transition-colors"
                        aria-label={isProgramExpanded ? `Retrair ${program.type}` : `Expandir ${program.type}`}
                        title={isProgramExpanded ? 'Retrair' : 'Expandir'}
                      >
                        {isProgramExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {isProgramExpanded && (
                    <div className={`p-2.5 sm:p-3 grid auto-rows-min gap-2 ${program.workouts.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                      {program.workouts.map((workout, idx) => (
                        <WorkoutCard
                          key={workout.id}
                          workout={{
                            ...workout,
                            sessionName: workout.sessionName || `Sessão ${idx + 1}`,
                          }}
                          onStart={handleStartWorkout}
                          onDelete={handleDeleteMyWorkout}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
