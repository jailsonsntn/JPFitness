import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Trash2, Play, Clock, Dumbbell, ChevronDown, ChevronUp,
  Zap, Copy, Star, CheckCircle2, X, Save
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { generateWorkoutPlan } from '../services/groqApi'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { getWorkouts, createWorkout, deleteWorkout, createWorkoutLog } from '../services/dbService'

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
const WEEK_DAYS = [
  { id: 'seg', label: 'Segunda-feira' },
  { id: 'ter', label: 'Terça-feira' },
  { id: 'qua', label: 'Quarta-feira' },
  { id: 'qui', label: 'Quinta-feira' },
  { id: 'sex', label: 'Sexta-feira' },
  { id: 'sab', label: 'Sábado' },
  { id: 'dom', label: 'Domingo' },
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

function createEmptyExercise() {
  return {
    name: '',
    sets: 3,
    reps: '10-12',
    rest: '60s',
    notes: '',
  }
}

function getInitialManualByDay() {
  return WEEK_DAYS.reduce((acc, day) => {
    acc[day.id] = [createEmptyExercise()]
    return acc
  }, {})
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

function parseAIPlanToWorkouts({ aiPlan, aiForm, userId, planName }) {
  const lines = (aiPlan || '').split('\n').map(l => l.trim()).filter(Boolean)
  const dayRegex = /dia\s*(\d+)\s*[:\-]\s*(.+)$/i
  const blocks = []
  let current = null

  for (const raw of lines) {
    const line = raw.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
    const dayMatch = line.match(dayRegex)

    if (dayMatch) {
      current = {
        dayNumber: dayMatch[1],
        title: dayMatch[2].trim(),
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

  const normalized = blocks.filter(b => b.exercises.length > 0)
  if (normalized.length === 0) return []

  const levelDb = LEVEL_TO_DB[aiForm.level] || 'intermediate'

  return normalized.map((block, idx) => {
    const name = normalized.length > 1
      ? `${planName} • Dia ${block.dayNumber}: ${block.title}`
      : planName

    return {
      user_id: userId,
      name,
      description: `Plano gerado por IA - ${aiForm.goal}`,
      emoji: '⚡',
      level: levelDb,
      estimated_duration_min: estimateWorkoutDuration(block.exercises),
      is_custom: true,
      tags: ['ai', `dias:${aiForm.days}`, `bloco:${idx + 1}`],
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

  const dayMatch = String(name).match(/(dia\s*\d+[:\-].+)$/i)
  if (dayMatch) {
    const base = String(name).replace(dayMatch[0], '').replace(/[\-•:]\s*$/, '').trim()
    return {
      programName: base || String(name),
      sessionName: dayMatch[1],
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

function WorkoutCard({ workout, onStart, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const displayName = workout.sessionName || workout.name

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl">{workout.emoji || '💪'}</span>
          <div className="min-w-0">
            <h3 className="text-white font-bold text-base leading-tight line-clamp-2 min-h-[48px]">{displayName}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className={`badge text-xs ${
                workout.level === 'Iniciante' ? 'bg-green-400/20 text-green-400' :
                workout.level === 'Intermediário' ? 'bg-yellow-400/20 text-yellow-400' :
                'bg-red-400/20 text-red-400'
              }`}>{workout.level}</span>
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
        <div className="border-t border-jp-border pt-3 mt-2 space-y-2">
          {workout.exercises.map((ex, i) => (
            <div key={i} className="py-2">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-jp-orange/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-jp-orange text-xs font-bold">{i + 1}</span>
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

      <button
        onClick={() => onStart(workout)}
        className="btn-primary w-full justify-center mt-auto"
      >
        <Play size={16} />
        Iniciar Treino
      </button>
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
    <div className="fixed inset-0 z-50 bg-jp-black overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-white">{workout.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-jp-gray text-sm">
              <span className="flex items-center gap-1 text-jp-orange">
                <Clock size={14} /> {formatTime(elapsedSeconds)}
              </span>
              <span>{progress}% concluído</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="btn-secondary"
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
              className="btn-primary"
            >
              <CheckCircle2 size={16} />
              Finalizar
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-jp-border rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-orange rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
              <p className="text-xs text-jp-gray mb-1">Séries concluídas</p>
              <p className="text-white font-bold">{completedCount}/{totalSets}</p>
            </div>
            <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
              <p className="text-xs text-jp-gray mb-1">Maior carga</p>
              <p className="text-white font-bold">{maxWeight > 0 ? `${maxWeight.toFixed(1)} kg` : '—'}</p>
            </div>
            <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
              <p className="text-xs text-jp-gray mb-1">Volume da sessão</p>
              <p className="text-white font-bold">{totalVolume > 0 ? `${Math.round(totalVolume)} kg-reps` : '—'}</p>
            </div>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-4">
          {workout.exercises.map((ex, exIndex) => {
            const exCompleted = completedSets[`${exIndex}`] || []
            const allDone = exCompleted.length === ex.sets

            return (
              <div key={exIndex} className={`card transition-all duration-300 ${allDone ? 'border-green-400/40 bg-green-400/5' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-jp-gray">Exercício {exIndex + 1}/{workout.exercises.length}</span>
                      {allDone && <CheckCircle2 size={14} className="text-green-400" />}
                    </div>
                    <h3 className="text-white font-bold">{ex.name}</h3>
                    <p className="text-jp-gray text-sm">{ex.reps} repetições • Descanso: {ex.rest}</p>
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
                          className={`w-full h-9 rounded-lg border font-bold text-sm transition-all duration-200 ${
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
  const { user, loading: authLoading } = useAuth()
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
    days: ['seg', 'ter', 'qua', 'qui', 'sex'],
    byDay: getInitialManualByDay(),
  })
  const [aiForm, setAiForm] = useState({ level: 'Intermediário', goal: GOALS_LIST[0], days: '3', equipment: EQUIPMENT_OPTIONS[0] })
  const [aiPlan, setAiPlan] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiPlanName, setAiPlanName] = useState('')

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
        setAiPlanName(`Plano IA - ${aiForm.goal} (${aiForm.days} dias)`)
      }
    } catch {
      setAiPlan('Erro ao gerar plano. Tente novamente.')
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

    const name = aiPlanName.trim() || `Plano IA - ${aiForm.goal} (${aiForm.days} dias)`
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

  const toggleDay = (dayId) => {
    setManualForm(prev => {
      const exists = prev.days.includes(dayId)
      const nextDays = exists ? prev.days.filter(d => d !== dayId) : [...prev.days, dayId]
      return { ...prev, days: nextDays }
    })
  }

  const setFullWeek = () => {
    setManualForm(prev => ({ ...prev, days: WEEK_DAYS.map(d => d.id) }))
  }

  const clearWeekSelection = () => {
    setManualForm(prev => ({ ...prev, days: [] }))
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
      days: ['seg', 'ter', 'qua', 'qui', 'sex'],
      byDay: getInitialManualByDay(),
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
    if (manualForm.days.length === 0) {
      alert('Selecione ao menos um dia da semana.')
      return
    }

    setManualSaving(true)
    let createdCount = 0

    try {
      for (const dayId of manualForm.days) {
        const dayLabel = WEEK_DAYS.find(d => d.id === dayId)?.label || dayId
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
          tags: ['manual', `estilo:${manualForm.style.toLowerCase()}`, `dia:${dayId}`],
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
      alert(`Plano semanal criado com sucesso! ${createdCount} dia(s) salvo(s).`)
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
    <div className="page-container pt-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Meus Treinos</h1>
          <p className="text-jp-gray">Crie treinos manuais por dia da semana, use modelos ou IA</p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <button
            onClick={() => setShowManualBuilder(!showManualBuilder)}
            className="btn-secondary flex-1 sm:flex-none"
          >
            <Plus size={16} />
            Criar Manual
          </button>
          <button
            onClick={() => setShowAIGenerator(!showAIGenerator)}
            className="btn-primary flex-1 sm:flex-none"
          >
            <Zap size={16} />
            Gerar com IA
          </button>
        </div>
      </div>

      {/* Manual Builder */}
      {showManualBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowManualBuilder(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative bg-jp-card border border-blue-400/30 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6"
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
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider">Dias da Semana</label>
                <div className="flex gap-2">
                  <button onClick={setFullWeek} className="text-xs text-jp-orange hover:underline">Semana completa</button>
                  <button onClick={clearWeekSelection} className="text-xs text-jp-gray hover:text-white">Limpar</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map(day => (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`px-3 py-2 rounded-xl border text-sm transition-colors ${
                      manualForm.days.includes(day.id)
                        ? 'bg-jp-orange border-jp-orange text-white'
                        : 'bg-jp-card border-jp-border text-jp-gray hover:border-jp-orange/40'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {manualForm.days.map(dayId => {
                const dayLabel = WEEK_DAYS.find(d => d.id === dayId)?.label || dayId
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
                <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Dias por Semana</label>
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
      <div className="flex gap-3 mb-6">
        <button onClick={() => setActiveTab('templates')} className={activeTab === 'templates' ? 'tab-btn-active' : 'tab-btn-inactive'}>
          <Star size={14} className="inline mr-1" />
          Modelos ({TEMPLATES.length})
        </button>
        <button onClick={() => setActiveTab('mine')} className={activeTab === 'mine' ? 'tab-btn-active' : 'tab-btn-inactive'}>
          <Dumbbell size={14} className="inline mr-1" />
          Meus Treinos ({myWorkouts.length})
        </button>
      </div>

      {/* Templates */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {TEMPLATES.map(template => (
            <div key={template.id} className="relative">
              <WorkoutCard workout={template} onStart={handleStartWorkout} />
              <button
                onClick={() => handleCopyTemplate(template)}
                className="absolute top-4 right-16 flex items-center gap-1 text-jp-gray hover:text-jp-orange text-xs transition-colors bg-jp-card-light px-2 py-1 rounded-lg border border-jp-border"
              >
                <Copy size={11} />
                Copiar
              </button>
            </div>
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
            <p className="text-jp-gray mb-6">Crie manualmente por dia da semana, copie um template ou use IA</p>
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
          <div className="space-y-6">
            {groupedPrograms.map(program => (
              <section key={program.name} className="card p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-jp-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-white font-bold text-lg">{program.name}</h3>
                    <p className="text-jp-gray text-sm">
                      {program.weeklyCount}x por semana • {program.totalExercises} exercícios no total
                    </p>
                  </div>
                  <span className="badge-dark text-xs w-fit">{program.type}</span>
                </div>

                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              </section>
            ))}
          </div>
        )
      )}
    </div>
  )
}
