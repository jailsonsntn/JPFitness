import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Dumbbell, Flame, TrendingUp, Calendar, Bot, Apple,
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
  getWeeklyWorkoutStats, getWorkoutLogs, getFoodLogs, getNutritionHistory, parseWorkoutLogMeta
} from '../services/dbService'

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
  { to: '/nutrition', label: 'Nutrição', icon: Apple, color: 'text-green-400 bg-green-400/10' },
]

function ProgressRing({ value, max, color, size = 80, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(value / max, 1)) * circumference

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#2A2A2A" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  )
}

export default function Dashboard() {
  const { user, profile, streak } = useAuth()
  const [quote, setQuote] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [weekData, setWeekData] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [loadHistory, setLoadHistory] = useState([])
  const [exerciseRecords, setExerciseRecords] = useState([])
  const [todayFood, setTodayFood] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const calorieGoal = profile?.daily_calorie_goal || 2000
  const todayCalories = todayFood.reduce((s, f) => s + (f.calories || 0), 0)
  const todayProtein = todayFood.reduce((s, f) => s + (parseFloat(f.protein_g) || 0), 0)
  const todayCarbs = todayFood.reduce((s, f) => s + (parseFloat(f.carbs_g) || 0), 0)
  const todayFat = todayFood.reduce((s, f) => s + (parseFloat(f.fat_g) || 0), 0)
  const caloriePct = Math.round((todayCalories / calorieGoal) * 100)

  const weekWorkouts = weekData.reduce((s, d) => s + d.workouts, 0)
  const weekMinutes = weekData.reduce((s, d) => s + d.minutes, 0)
  const avgMaxWeight = loadHistory.length
    ? (loadHistory.reduce((sum, item) => sum + item.maxWeight, 0) / loadHistory.length)
    : 0
  const totalLoad30d = loadHistory.reduce((sum, item) => sum + item.sessionVolume, 0)
  const loadTrend = loadHistory.length >= 2
    ? loadHistory[loadHistory.length - 1].maxWeight - loadHistory[0].maxWeight
    : 0

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
      getWeeklyWorkoutStats(user.id),
      getWorkoutLogs(user.id, 30),
      getFoodLogs(user.id),
    ])
      .then(([week, logs, food]) => {
        setWeekData(week)
        setRecentLogs((logs || []).slice(0, 3))
        const history = (logs || [])
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
          .filter(item => item.maxWeight > 0 || item.sessionVolume > 0)
        setLoadHistory(history)

        const recordsMap = new Map()
        ;(logs || []).forEach(log => {
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

        setExerciseRecords(
          Array.from(recordsMap.values())
            .sort((a, b) => b.maxWeight - a.maxWeight)
            .slice(0, 5)
        )
        setTodayFood(food)
      })
      .catch(console.error)
      .finally(() => setDataLoading(false))
  }, [user])

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Atleta'

  const macros = [
    { label: 'Proteína', value: Math.round(todayProtein), goal: Math.round(calorieGoal * 0.3 / 4), color: '#3B82F6', unit: 'g' },
    { label: 'Carbs', value: Math.round(todayCarbs), goal: Math.round(calorieGoal * 0.45 / 4), color: '#F59E0B', unit: 'g' },
    { label: 'Gordura', value: Math.round(todayFat), goal: Math.round(calorieGoal * 0.25 / 9), color: '#10B981', unit: 'g' },
  ]

  return (
    <div className="page-container pt-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">
            Olá, {firstName}! 👋
          </h1>
          <p className="text-jp-gray mt-1">Veja seu progresso de hoje</p>
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

      {/* AI Quote */}
      <div className="card gradient-border mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-jp-orange/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-start gap-4 relative">
          <div className="w-10 h-10 bg-jp-orange/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap size={20} className="text-jp-orange" />
          </div>
          <div>
            <p className="text-xs font-semibold text-jp-orange mb-1">Motivação do Dia • Groq AI</p>
            {quoteLoading ? (
              <LoadingSpinner size="sm" text="Carregando motivação..." />
            ) : (
              <p className="text-white font-medium text-lg leading-relaxed italic">"{quote}"</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Treinos esta semana', value: dataLoading ? '—' : String(weekWorkouts), icon: Dumbbell, color: 'text-jp-orange', bg: 'bg-jp-orange/10', change: 'semana atual' },
          { label: 'Sequência atual', value: dataLoading ? '—' : `${streak?.current_streak || 0} dias`, icon: Flame, color: 'text-red-400', bg: 'bg-red-400/10', change: streak?.current_streak >= (streak?.longest_streak || 0) ? '🔥 Recorde pessoal!' : `Melhor: ${streak?.longest_streak || 0} dias` },
          { label: 'Kcal hoje', value: dataLoading ? '—' : String(todayCalories), icon: Target, color: 'text-green-400', bg: 'bg-green-400/10', change: `Meta: ${calorieGoal} kcal` },
          { label: 'Minutos ativos', value: dataLoading ? '—' : String(weekMinutes), icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', change: 'esta semana' },
        ].map(({ label, value, icon: Icon, color, bg, change }) => (
          <div key={label} className="card">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-2xl font-black text-white mb-0.5">{value}</p>
            <p className="text-jp-gray text-xs mb-1">{label}</p>
            <p className={`text-xs font-medium ${color}`}>{change}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Weekly activity */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Atividade Semanal</h2>
            <span className="badge-dark">Treinos / dia</span>
          </div>
          {dataLoading ? (
            <div className="h-44 flex items-center justify-center"><LoadingSpinner /></div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="calGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6200" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF6200" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="day" tick={{ fill: '#A0A0A0', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', color: '#fff' }}
                  labelStyle={{ color: '#FF6200', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="workouts" name="Treinos" stroke="#FF6200" fill="url(#calGradient)" strokeWidth={2} dot={{ fill: '#FF6200', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Calorie ring */}
        <div className="card flex flex-col items-center justify-center">
          <h2 className="text-lg font-bold text-white mb-4">Meta Calórica</h2>
          <div className="relative">
            <ProgressRing value={todayCalories} max={calorieGoal} color="#FF6200" size={120} strokeWidth={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{caloriePct}%</span>
              <span className="text-jp-gray text-xs">atingido</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-white font-bold">{todayCalories} <span className="text-jp-gray font-normal">/ {calorieGoal} kcal</span></p>
            <p className="text-jp-orange text-sm mt-1">
              {calorieGoal - todayCalories > 0
                ? `Restam ${calorieGoal - todayCalories} kcal`
                : `+${todayCalories - calorieGoal} kcal acima da meta`}
            </p>
          </div>
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
                <p className="text-white text-2xl font-black">{avgMaxWeight > 0 ? `${avgMaxWeight.toFixed(1)} kg` : '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-jp-card-light border border-jp-border">
                <p className="text-jp-gray text-xs mb-1">Volume acumulado (30 dias)</p>
                <p className="text-white text-2xl font-black">{Math.round(totalLoad30d)} kg-reps</p>
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
            <span className="badge-dark">Kg por sessão</span>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', color: '#fff' }}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Macros */}
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-4">Macros de Hoje</h2>
          {todayFood.length === 0 && !dataLoading ? (
            <div className="text-center py-4">
              <p className="text-jp-gray text-sm">Nenhuma refeição registrada hoje</p>
              <Link to="/nutrition" className="text-jp-orange text-sm font-semibold mt-2 inline-block hover:underline">
                Registrar refeição →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {macros.map(({ label, value, goal, color, unit }) => {
                const pct = Math.min(Math.round((value / goal) * 100), 100)
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-jp-gray-light font-medium">{label}</span>
                      <span className="text-white font-semibold">{value}/{goal}{unit}</span>
                    </div>
                    <div className="h-2 bg-jp-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <p className="text-xs mt-1 font-medium" style={{ color }}>{pct}% da meta</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent workouts */}
        <div className="card lg:col-span-2">
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
                  <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-jp-card-light border border-jp-border">
                    <div className="text-2xl">💪</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{log.name}</p>
                      <p className="text-jp-gray text-xs">{dateStr}</p>
                    </div>
                    {maxWeight > 0 && (
                      <div className="px-2 py-1 rounded-lg bg-jp-orange/15 border border-jp-orange/30 text-[11px] font-semibold text-jp-orange">
                        Máx {maxWeight.toFixed(1)}kg{trackedSets > 0 ? ` · ${trackedSets} séries` : ''}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-jp-orange text-sm font-medium">
                      <Clock size={12} />
                      {dur}
                    </div>
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
