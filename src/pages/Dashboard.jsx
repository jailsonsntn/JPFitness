import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Dumbbell, Flame, TrendingUp, Calendar, Bot,
  BookOpen, ChevronRight, Zap, Target, Clock, Award, User
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import LoadingSpinner from '../components/LoadingSpinner'
import { getMotivationalQuote } from '../services/groqApi'
import { useAuth } from '../context/AuthContext'
import {
  getWorkoutLogs, parseWorkoutLogMeta, getWorkouts
} from '../services/dbService'

const CARDIO_LABELS = {
  run: 'Corrida',
  walk: 'Caminhada',
  bike: 'Bicicleta',
}

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Última semana' },
  { id: 'month', label: 'Último mês' },
  { id: '60d', label: 'Últimos 60 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'year', label: 'Último ano' },
  { id: 'custom', label: 'Personalizado' },
]

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function shiftDays(baseDate, days) {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + days)
  return d
}

function toInputDateValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function resolveRangeBounds(period, customStart, customEnd) {
  const now = new Date()

  if (period === 'custom') {
    if (!customStart || !customEnd) return { valid: false, start: null, end: null }
    const start = startOfDay(new Date(`${customStart}T00:00:00`))
    const end = endOfDay(new Date(`${customEnd}T00:00:00`))
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { valid: false, start: null, end: null }
    }
    return { valid: true, start, end }
  }

  let start = startOfDay(now)
  if (period === 'week') start = startOfDay(shiftDays(now, -6))
  if (period === 'month') start = startOfDay(shiftDays(now, -29))
  if (period === '60d') start = startOfDay(shiftDays(now, -59))
  if (period === '90d') start = startOfDay(shiftDays(now, -89))
  if (period === 'year') start = startOfDay(shiftDays(now, -364))

  return { valid: true, start, end: endOfDay(now) }
}

function formatPeriodLabel(period, start, end) {
  const map = {
    today: 'Hoje',
    week: 'Última semana',
    month: 'Último mês',
    '60d': 'Últimos 60 dias',
    '90d': 'Últimos 90 dias',
    year: 'Último ano',
    custom: 'Personalizado',
  }

  if (period !== 'custom') return map[period] || 'Período'
  if (!start || !end) return 'Personalizado'

  const startStr = start.toLocaleDateString('pt-BR')
  const endStr = end.toLocaleDateString('pt-BR')
  return `${startStr} até ${endStr}`
}

function parseProgramName(name = '') {
  return String(name).split('•')[0].trim() || String(name)
}

function getCardioFromLog(log) {
  const { meta } = parseWorkoutLogMeta(log?.notes)
  const name = String(log?.name || '').toLowerCase()
  const isCardio = meta?.sessionType === 'cardio' || name.startsWith('cardio:')
  if (!isCardio) return null

  let cardioType = meta?.cardioType || 'run'
  if (!meta?.cardioType) {
    if (name.includes('caminhada')) cardioType = 'walk'
    else if (name.includes('bicicleta') || name.includes('bike')) cardioType = 'bike'
    else cardioType = 'run'
  }

  return {
    id: log.id,
    cardioType,
    distanceKm: Number(meta?.distanceKm || 0),
    durationMin: Number(meta?.durationMin || (log?.duration_seconds || 0) / 60 || 0),
    calories: Number(log?.calories_burned || meta?.estimatedCalories || 0),
    startedAt: log?.started_at,
    date: log?.started_at
      ? new Date(log.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : '--/--',
  }
}

function getWeightStatsFromLog(log) {
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

const quickLinks = [
  { to: '/exercises', label: 'Ver Exercícios', icon: BookOpen, color: 'text-blue-400 bg-blue-400/10' },
  { to: '/workouts', label: 'Meus Treinos', icon: Dumbbell, color: 'text-jp-orange bg-jp-orange/10' },
  { to: '/ai-trainer', label: 'Treinador IA', icon: Bot, color: 'text-purple-400 bg-purple-400/10' },
]

export default function Dashboard() {
  const { user, profile, streak } = useAuth()
  const [quote, setQuote] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [allLogs, setAllLogs] = useState([])
  const [allWorkouts, setAllWorkouts] = useState([])
  const [period, setPeriod] = useState('week')
  const [customStart, setCustomStart] = useState(() => toInputDateValue(shiftDays(new Date(), -29)))
  const [customEnd, setCustomEnd] = useState(() => toInputDateValue(new Date()))
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    getMotivationalQuote()
      .then(q => setQuote(q))
      .catch(() => setQuote('Cada treino é um passo rumo à sua melhor versão. 💪'))
      .finally(() => setQuoteLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    setDataLoading(true)
    Promise.all([
      getWorkoutLogs(user.id, 500),
      getWorkouts(user.id),
    ])
      .then(([logs, workouts]) => {
        setAllLogs(logs || [])
        setAllWorkouts(workouts || [])
      })
      .catch(console.error)
      .finally(() => setDataLoading(false))
  }, [user])

  const rangeBounds = useMemo(() => resolveRangeBounds(period, customStart, customEnd), [period, customStart, customEnd])

  const filteredLogs = useMemo(() => {
    if (!rangeBounds.valid) return []
    return allLogs.filter(log => {
      const dt = log?.started_at ? new Date(log.started_at) : null
      if (!dt || Number.isNaN(dt.getTime())) return false
      return dt >= rangeBounds.start && dt <= rangeBounds.end
    })
  }, [allLogs, rangeBounds])

  const strengthLogs = useMemo(
    () => filteredLogs.filter(log => !getCardioFromLog(log)),
    [filteredLogs]
  )

  const cardioLogs = useMemo(
    () => filteredLogs.map(getCardioFromLog).filter(Boolean),
    [filteredLogs]
  )

  const weekData = useMemo(() => {
    if (!rangeBounds.valid) return []
    const daysSpan = Math.max(1, Math.round((rangeBounds.end - rangeBounds.start) / 86400000) + 1)

    if (daysSpan > 120) {
      const map = new Map()
      filteredLogs.forEach(log => {
        const dt = new Date(log.started_at)
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
        const label = dt.toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })
        const prev = map.get(key) || { day: label, workouts: 0, minutes: 0 }
        prev.workouts += 1
        prev.minutes += Math.round(Number(log?.duration_seconds || 0) / 60)
        map.set(key, prev)
      })
      return Array.from(map.values())
    }

    const arr = []
    const map = new Map()
    for (let i = 0; i < daysSpan; i += 1) {
      const date = shiftDays(rangeBounds.start, i)
      const key = date.toDateString()
      arr.push({
        key,
        day: date.toLocaleDateString('pt-BR', daysSpan <= 14 ? { weekday: 'short' } : { day: '2-digit', month: '2-digit' }),
        workouts: 0,
        minutes: 0,
      })
      map.set(key, arr.length - 1)
    }

    filteredLogs.forEach(log => {
      const dt = new Date(log.started_at)
      const idx = map.get(dt.toDateString())
      if (idx === undefined) return
      arr[idx].workouts += 1
      arr[idx].minutes += Math.round(Number(log?.duration_seconds || 0) / 60)
    })

    return arr.map(({ day, workouts, minutes }) => ({ day, workouts, minutes }))
  }, [filteredLogs, rangeBounds])

  const recentLogs = useMemo(() => strengthLogs.slice(0, 3), [strengthLogs])

  const loadHistory = useMemo(
    () => strengthLogs
      .slice()
      .reverse()
      .map(log => {
        const { maxWeight, sessionVolume, trackedSets } = getWeightStatsFromLog(log)
        return {
          id: log.id,
          date: new Date(log.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          maxWeight,
          sessionVolume,
          trackedSets,
        }
      })
      .filter(item => item.maxWeight > 0 || item.sessionVolume > 0),
    [strengthLogs]
  )

  const exerciseRecords = useMemo(() => {
    const recordsMap = new Map()
    strengthLogs.forEach(log => {
      ;(log.workout_log_sets || []).forEach(set => {
        const exerciseName = set.exercise_name || 'Exercício'
        const weight = Number(set.weight_kg || 0)
        const reps = Number(set.reps_completed || 0)
        if (weight <= 0) return

        const current = recordsMap.get(exerciseName) || {
          exerciseName,
          maxWeight: 0,
          totalVolume: 0,
        }

        current.maxWeight = Math.max(current.maxWeight, weight)
        current.totalVolume += weight * reps
        recordsMap.set(exerciseName, current)
      })
    })

    return Array.from(recordsMap.values())
      .sort((a, b) => b.maxWeight - a.maxWeight)
      .slice(0, 5)
  }, [strengthLogs])

  const panelSummary = useMemo(() => {
    const programs = new Set(allWorkouts.map(w => parseProgramName(w?.name || ''))).size
    const uniqueExercises = new Set(
      allWorkouts
        .flatMap(w => w?.workout_exercises || [])
        .map(ex => String(ex?.exercise_name || '').trim().toLowerCase())
        .filter(Boolean)
    ).size
    const activeDays = new Set(strengthLogs.map(log => new Date(log.started_at).toDateString())).size

    return {
      programs,
      sessions: allWorkouts.length,
      uniqueExercises,
      activeDays,
    }
  }, [allWorkouts, strengthLogs])

  const cardioSummary = useMemo(() => {
    const base = cardioLogs.reduce((acc, item) => {
      acc.totalSessions += 1
      acc.totalDistanceKm += item.distanceKm
      acc.totalDurationMin += item.durationMin
      acc.totalCalories += item.calories
      acc.byType[item.cardioType] = (acc.byType[item.cardioType] || 0) + 1
      return acc
    }, {
      totalSessions: 0,
      totalDistanceKm: 0,
      totalDurationMin: 0,
      totalCalories: 0,
      byType: { run: 0, walk: 0, bike: 0 },
    })

    return {
      ...base,
      recent: cardioLogs.slice(0, 5),
      trend: cardioLogs
        .slice(0, 10)
        .reverse()
        .map(item => ({ date: item.date, calories: Math.round(item.calories), distance: Number(item.distanceKm.toFixed(2)) })),
    }
  }, [cardioLogs])

  const weekWorkouts = weekData.reduce((s, d) => s + d.workouts, 0)
  const weekMinutes = weekData.reduce((s, d) => s + d.minutes, 0)
  const avgMaxWeight = loadHistory.length
    ? (loadHistory.reduce((sum, item) => sum + item.maxWeight, 0) / loadHistory.length)
    : 0
  const totalLoad30d = loadHistory.reduce((sum, item) => sum + item.sessionVolume, 0)
  const loadTrend = loadHistory.length >= 2
    ? loadHistory[loadHistory.length - 1].maxWeight - loadHistory[0].maxWeight
    : 0
  const periodLabel = formatPeriodLabel(period, rangeBounds.start, rangeBounds.end)

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Atleta'

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">
            Olá, {firstName}! 👋
          </h1>
          <p className="text-jp-gray mt-1">Veja seu progresso no período selecionado</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/profile" className="flex items-center gap-2 bg-jp-card border border-jp-border hover:border-jp-orange/40 rounded-xl px-3 py-2 text-sm text-jp-gray hover:text-white transition-all">
            <User size={14} />
            Perfil
          </Link>
          <div className="flex items-center gap-2 bg-jp-card border border-jp-border rounded-xl px-4 py-2">
            <Calendar size={16} className="text-jp-orange" />
            <span className="text-sm text-jp-gray-light">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-white font-semibold text-base">Filtros do Painel</h2>
            <span className="badge-dark text-xs">{periodLabel}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setPeriod(option.id)}
                className={period === option.id ? 'tab-btn-active' : 'tab-btn-inactive'}
              >
                {option.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-jp-gray text-xs block mb-1">Data inicial</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="input-dark py-2"
                />
              </div>
              <div>
                <label className="text-jp-gray text-xs block mb-1">Data final</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="input-dark py-2"
                />
              </div>
            </div>
          )}

          {period === 'custom' && !rangeBounds.valid && (
            <p className="text-yellow-400 text-xs">Selecione data inicial e final válidas para aplicar o filtro personalizado.</p>
          )}
        </div>
      </div>

      {/* AI Quote */}
      <div className="card mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-jp-orange/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-start gap-4 relative">
          <div className="w-10 h-10 bg-jp-orange/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap size={20} className="text-jp-orange" />
          </div>
          <div>
            <p className="text-xs font-semibold text-jp-orange mb-1">Motivação do Dia • IA</p>
            {quoteLoading ? (
              <LoadingSpinner size="sm" text="Carregando motivação..." />
            ) : (
              <p className="text-white font-normal text-base leading-relaxed italic">"{quote}"</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Treinos no período', value: dataLoading ? '—' : String(weekWorkouts), icon: Dumbbell, color: 'text-jp-orange', bg: 'bg-jp-orange/10', change: periodLabel },
          { label: 'Sequência atual', value: dataLoading ? '—' : `${streak?.current_streak || 0} dias`, icon: Flame, color: 'text-red-400', bg: 'bg-red-400/10', change: streak?.current_streak >= (streak?.longest_streak || 0) ? '🔥 Recorde pessoal!' : `Melhor: ${streak?.longest_streak || 0} dias` },
          { label: 'Carga máxima média', value: dataLoading ? '—' : `${avgMaxWeight.toFixed(1)} kg`, icon: Target, color: 'text-green-400', bg: 'bg-green-400/10', change: 'média no período' },
          { label: 'Minutos ativos', value: dataLoading ? '—' : String(weekMinutes), icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', change: periodLabel },
        ].map(({ label, value, icon: Icon, color, bg, change }) => (
          <div key={label} className="card">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-white mb-0.5">{value}</p>
            <p className="text-jp-gray text-xs mb-1">{label}</p>
            <p className={`text-xs font-medium ${color}`}>{change}</p>
          </div>
        ))}
      </div>

      {/* Painel geral */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Painel Geral</h2>
          <span className="badge-dark">Visão consolidada</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Programas</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : panelSummary.programs}</p>
          </div>
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Sessões planejadas</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : panelSummary.sessions}</p>
          </div>
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Exercícios únicos</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : panelSummary.uniqueExercises}</p>
          </div>
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Dias ativos (período)</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : panelSummary.activeDays}</p>
          </div>
        </div>
      </div>

      {/* Análise cardio */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Análise de Cardio</h2>
          <span className="badge-dark">Corrida • Caminhada • Bicicleta</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Sessões</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : cardioSummary.totalSessions}</p>
          </div>
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Distância total</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : `${cardioSummary.totalDistanceKm.toFixed(1)} km`}</p>
          </div>
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Tempo total</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : `${Math.round(cardioSummary.totalDurationMin)} min`}</p>
          </div>
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-jp-gray text-xs">Calorias estimadas</p>
            <p className="text-white font-semibold text-xl leading-tight">{dataLoading ? '—' : `${Math.round(cardioSummary.totalCalories)} kcal`}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-xs text-jp-gray uppercase tracking-wider font-semibold mb-2">Distribuição por modalidade</p>
            <div className="space-y-2 text-sm">
              {Object.entries(CARDIO_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <p className="text-white">{label}</p>
                  <p className="text-jp-orange font-semibold">{cardioSummary.byType[key] || 0}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-jp-border bg-jp-card-light p-3">
            <p className="text-xs text-jp-gray uppercase tracking-wider font-semibold mb-2">Evolução de cardio (kcal por sessão)</p>
            {dataLoading ? (
              <div className="h-36 flex items-center justify-center"><LoadingSpinner size="sm" /></div>
            ) : cardioSummary.trend.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-jp-gray text-sm">Sem cardio registrado ainda</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={cardioSummary.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                  <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: '12px', color: '#fff' }}
                    labelStyle={{ color: '#FF6200', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="calories" name="kcal" stroke="#FF6200" strokeWidth={2.5} dot={{ fill: '#FF6200', r: 2.5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-jp-border">
          <p className="text-xs text-jp-gray uppercase tracking-wider font-semibold mb-2">Últimos cardios</p>
          {dataLoading ? (
            <div className="py-4 flex justify-center"><LoadingSpinner size="sm" /></div>
          ) : cardioSummary.recent.length === 0 ? (
            <p className="text-jp-gray text-sm">Registre cardio na tela de Treinos para ver a análise aqui.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {cardioSummary.recent.map(item => (
                <div key={item.id} className="rounded-xl border border-jp-border bg-jp-card-light p-2.5">
                  <p className="text-white font-medium text-sm">{CARDIO_LABELS[item.cardioType] || 'Cardio'}</p>
                  <p className="text-jp-gray text-xs mt-0.5">{item.date} • {item.distanceKm.toFixed(1)} km • {Math.round(item.durationMin)} min</p>
                  <p className="text-jp-orange text-xs font-semibold mt-1">{Math.round(item.calories)} kcal</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Weekly activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Atividade no Período</h2>
            <span className="badge-dark">Treinos por faixa</span>
          </div>
          {dataLoading ? (
            <div className="h-44 flex items-center justify-center"><LoadingSpinner /></div>
          ) : weekData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-jp-gray text-sm">Sem atividades para o período selecionado.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="calGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6200" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF6200" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis dataKey="day" tick={{ fill: '#A0A0A0', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: '12px', color: '#fff' }}
                  labelStyle={{ color: '#FF6200', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="workouts" name="Treinos" stroke="#FF6200" fill="url(#calGradient)" strokeWidth={2} dot={{ fill: '#FF6200', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-jp-orange" />
            <h2 className="text-lg font-bold text-white">Monitoramento de Carga</h2>
          </div>
          {dataLoading ? (
            <div className="py-8 flex justify-center"><LoadingSpinner /></div>
          ) : loadHistory.length === 0 ? (
            <p className="text-jp-gray text-sm">Finalize treinos preenchendo kg por série para começar seu monitoramento de cargas.</p>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-jp-card-light border border-jp-border">
                <p className="text-jp-gray text-xs mb-1">Maior carga média por sessão</p>
                <p className="text-white text-2xl font-semibold">{avgMaxWeight > 0 ? `${avgMaxWeight.toFixed(1)} kg` : '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-jp-card-light border border-jp-border">
                <p className="text-jp-gray text-xs mb-1">Volume acumulado (período)</p>
                <p className="text-white text-2xl font-semibold">{Math.round(totalLoad30d)} kg-reps</p>
              </div>
              <div className="p-3 rounded-xl bg-jp-card-light border border-jp-border">
                <p className="text-jp-gray text-xs mb-1">Tendência de evolução</p>
                <p className={`text-lg font-bold ${loadTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {loadTrend >= 0 ? '+' : ''}{loadTrend.toFixed(1)} kg (máx/sessão)
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Evolução da Carga Máxima por Treino</h2>
            <span className="badge-dark hidden sm:inline-flex">Kg por sessão</span>
          </div>
          {dataLoading ? (
            <div className="h-52 flex items-center justify-center"><LoadingSpinner /></div>
          ) : loadHistory.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-jp-gray text-sm text-center px-6">
              Ainda sem dados de carga. Ao finalizar cada treino, preencha os kg por série para gerar o histórico de evolução.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={loadHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: '12px', color: '#fff' }}
                  labelStyle={{ color: '#FF6200', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="maxWeight" name="Carga máxima (kg)" stroke="#FF6200" strokeWidth={3} dot={{ fill: '#FF6200', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {exerciseRecords.length > 0 && (
            <div className="mt-5 pt-4 border-t border-jp-border space-y-2">
              <p className="text-xs text-jp-gray uppercase tracking-wider font-semibold">Melhores cargas por exercício</p>
              {exerciseRecords.map(record => (
                <div key={record.exerciseName} className="flex items-center justify-between text-sm">
                  <p className="text-white truncate pr-3">{record.exerciseName}</p>
                  <p className="text-jp-orange font-semibold whitespace-nowrap">{record.maxWeight.toFixed(1)} kg</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Recent workouts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Treinos Recentes</h2>
            <Link to="/workouts" className="text-jp-orange text-sm font-medium hover:underline flex items-center gap-1">
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>

          {dataLoading ? (
            <div className="py-8 flex justify-center"><LoadingSpinner /></div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-8">
              <Dumbbell size={32} className="text-jp-border mx-auto mb-2" />
              <p className="text-jp-gray text-sm">Nenhum treino registrado ainda</p>
              <Link to="/workouts" className="text-jp-orange text-sm font-semibold mt-2 inline-block hover:underline">
                Iniciar primeiro treino →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map(log => {
                const dur = log.duration_seconds ? `${Math.round(log.duration_seconds / 60)} min` : '—'
                const dateStr = new Date(log.started_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
                const { maxWeight, trackedSets } = getWeightStatsFromLog(log)
                return (
                  <div key={log.id} className="p-3 rounded-xl bg-jp-card-light border border-jp-border">
                    <div className="flex items-start gap-3">
                      <div className="text-xl mt-0.5">💪</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm leading-snug break-words">{log.name}</p>
                        <p className="text-jp-gray text-xs mt-0.5">{dateStr}</p>
                      </div>
                      <div className="flex items-center gap-1 text-jp-orange text-xs sm:text-sm font-medium whitespace-nowrap">
                        <Clock size={12} />
                        {dur}
                      </div>
                    </div>

                    {maxWeight > 0 && (
                      <div className="mt-2 ml-8 px-2 py-1 rounded-lg bg-jp-orange/10 border border-jp-orange/25 text-[11px] font-medium text-jp-orange w-fit max-w-full break-words">
                        Máx {maxWeight.toFixed(1)}kg{trackedSets > 0 ? ` · ${trackedSets} séries` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-jp-border">
            {quickLinks.map(({ to, label, icon: Icon, color }) => (
              <Link key={to} to={to} className={`flex flex-col items-center gap-2 p-3 rounded-xl ${color.split(' ')[1]} hover:opacity-80 transition-opacity`}>
                <Icon size={18} className={color.split(' ')[0]} />
                <span className="text-white text-xs font-medium text-center">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Streak achievement */}
      {streak?.current_streak >= 3 && (
        <div className="mt-6 card bg-gradient-to-r from-jp-orange/20 to-jp-orange-dark/20 border-jp-orange/30">
          <div className="flex items-center gap-4">
            <Award size={32} className="text-jp-orange flex-shrink-0" />
            <div>
              <p className="text-white font-bold">🏆 {streak.current_streak} dias de sequência!</p>
              <p className="text-jp-gray text-sm">Incrível! Você treinou {streak.current_streak} dias seguidos. Continue assim!</p>
            </div>
            <div className="ml-auto">
              <span className="badge-orange">+{streak.current_streak * 10} XP</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
