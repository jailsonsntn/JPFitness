import { useState, useEffect, useMemo } from 'react'
import { Clock, Save, Heart, Activity, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { createWorkoutLog, getWorkoutLogs, parseWorkoutLogMeta } from '../services/dbService'

const CARDIO_TYPES = [
  { id: 'run', label: 'Corrida', emoji: '🏃' },
  { id: 'walk', label: 'Caminhada', emoji: '🚶' },
  { id: 'bike', label: 'Bicicleta', emoji: '🚴' },
  { id: 'elliptical', label: 'Elíptico', emoji: '🏃‍♀️' },
  { id: 'rowing', label: 'Remo', emoji: '🚣' },
  { id: 'swimming', label: 'Natação', emoji: '🏊' },
]

const HR_ZONES = {
  zone1: { name: 'Recuperação', color: 'blue', min: 0.50, max: 0.60, description: 'Fácil, recuperação' },
  zone2: { name: 'Queima de Gordura', color: 'green', min: 0.60, max: 0.70, description: 'Emagrecer, fácil' },
  zone3: { name: 'Aeróbica', color: 'yellow', min: 0.70, max: 0.80, description: 'Resistência' },
  zone4: { name: 'Limiar', color: 'orange', min: 0.80, max: 0.90, description: 'Trabalho duro' },
  zone5: { name: 'VO2 Máx', color: 'red', min: 0.90, max: 1.0, description: 'Máxima intensidade' },
}

// MET values mais precisos
const METs = {
  walk: 3.5,
  'walk-brisk': 4.5,
  'walk-very-brisk': 5.5,
  bike: 6.8,
  'bike-vigorous': 10.0,
  run_slow: 6.0,
  run_moderate: 9.8,
  run_fast: 12.3,
  elliptical: 5.5,
  'elliptical-vigorous': 9.0,
  rowing: 4.8,
  'rowing-vigorous': 12.0,
  swimming: 6.0,
  'swimming-vigorous': 11.0,
}

function calculateMaxHR(age, sex) {
  // Fórmulas mais aceitas
  return sex === 'female' ? 226 - age : 220 - age
}

function calculateHRZone(maxHR, restingHR, percentage) {
  // Fórmula de Karvonen
  const reserve = maxHR - restingHR
  return Math.round(restingHR + (reserve * percentage))
}

function calculateCaloriesKarvonen(maxHR, restingHR, weight, age, sex, avgHR, durationMin) {
  // Cálculo mais preciso usando Karvonen
  const reserve = maxHR - restingHR
  const intensity = (avgHR - restingHR) / reserve // %
  
  // Ajuste por sexo (mulheres têm metabolismo basal ligeiramente diferente)
  const metAdjustment = sex === 'female' ? 0.95 : 1.0
  
  // MET estimado pela FC (aproximado)
  const estimatedMET = 0.6 * intensity * (maxHR / 100) * 20 * metAdjustment
  
  return Math.round(estimatedMET * weight * (durationMin / 60) * 5)
}

function estimateMetFromType(type, intensity = 'moderate') {
  const key = intensity === 'vigorous' ? `${type}-vigorous` : type
  return METs[key] || METs[type] || 5
}

export default function Cardio() {
  const { user, profile } = useAuth()
  const [cardioForm, setCardioForm] = useState({
    type: 'run',
    durationMin: '30',
    distanceKm: '5',
    weightKg: profile?.weight_kg || '',
    restingHR: profile?.resting_hr || '70',
    avgHR: '',
    minHR: '',
    maxHR: '',
    incline: '0',
    resistance: '0',
    effort: '5',
    notes: '',
  })

  const [cardioSaving, setCardioSaving] = useState(false)
  const [cardioFeedback, setCardioFeedback] = useState(null)
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Dados do usuário
  const userAge = useMemo(() => {
    if (!profile?.birth_date) return 30
    const birthDate = new Date(profile.birth_date)
    const today = new Date()
    return Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000))
  }, [profile?.birth_date])

  const userSex = profile?.sex || 'male'
  const userWeight = Number(cardioForm.weightKg || profile?.weight_kg || 70)

  // Cálculos de frequência cardíaca
  const maxHR = useMemo(() => calculateMaxHR(userAge, userSex), [userAge, userSex])
  const restingHR = Number(cardioForm.restingHR || 70)

  const heartRateInfo = useMemo(() => {
    const avgHR = Number(cardioForm.avgHR || 0)
    if (avgHR === 0) return null

    const intensity = ((avgHR - restingHR) / (maxHR - restingHR)) * 100
    let zone = null
    for (const [key, zoneData] of Object.entries(HR_ZONES)) {
      if (intensity >= zoneData.min * 100 && intensity < zoneData.max * 100) {
        zone = { key, ...zoneData, intensity: Math.round(intensity) }
        break
      }
    }

    return { avgHR, intensity: Math.round(intensity), zone }
  }, [cardioForm.avgHR, maxHR, restingHR])

  // Cálculo de calorias
  const caloriesInfo = useMemo(() => {
    const durationMin = Number(cardioForm.durationMin || 0)
    const distance = Number(cardioForm.distanceKm || 0)
    const avgHR = Number(cardioForm.avgHR || 0)
    const effort = Number(cardioForm.effort || 5)

    if (durationMin <= 0 || userWeight <= 0) {
      return null
    }

    let calories = 0

    if (avgHR > 0 && restingHR > 0) {
      // Método Karvonen (mais preciso com FC)
      calories = calculateCaloriesKarvonen(maxHR, restingHR, userWeight, userAge, userSex, avgHR, durationMin)
    } else {
      // Método MET fallback
      const intensityMap = {
        walk: 'walk',
        run_slow: effort < 4 ? 'run_slow' : effort < 7 ? 'run_moderate' : 'run_fast',
        bike: effort < 4 ? 'bike' : 'bike-vigorous',
        elliptical: effort < 6 ? 'elliptical' : 'elliptical-vigorous',
        rowing: effort < 6 ? 'rowing' : 'rowing-vigorous',
        swimming: effort < 6 ? 'swimming' : 'swimming-vigorous',
      }

      const met = METs[intensityMap[cardioForm.type]] || METs[cardioForm.type] || 5
      calories = Math.round(met * 3.5 * userWeight / 200 * durationMin)
    }

    const speedKmh = distance > 0 ? distance / (durationMin / 60) : 0
    const paceMinKm = distance > 0 ? durationMin / distance : 0

    return { calories, speedKmh, paceMinKm, distance, durationMin }
  }, [cardioForm, userWeight, maxHR, restingHR, userAge, userSex])

  useEffect(() => {
    const profileWeight = Number(profile?.weight_kg || 0)
    if (profileWeight > 0 && !cardioForm.weightKg) {
      setCardioForm(prev => ({ ...prev, weightKg: String(profileWeight) }))
    }
    if (profile?.resting_hr && !cardioForm.restingHR) {
      setCardioForm(prev => ({ ...prev, restingHR: String(profile.resting_hr) }))
    }
  }, [profile?.weight_kg, profile?.resting_hr])

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
      const avgHR = Number(meta?.avgHR || 0)

      acc.totalSessions += 1
      acc.totalDistanceKm += distanceKm
      acc.totalDurationMin += durationMin
      acc.totalCalories += calories
      if (avgHR > 0) acc.avgHRValues.push(avgHR)
      acc.byType[type] = (acc.byType[type] || 0) + 1
      return acc
    }, {
      totalSessions: 0,
      totalDistanceKm: 0,
      totalDurationMin: 0,
      totalCalories: 0,
      avgHRValues: [],
      byType: { run: 0, walk: 0, bike: 0, elliptical: 0, rowing: 0, swimming: 0 }
    })

    const avgHR = totals.avgHRValues.length > 0
      ? Math.round(totals.avgHRValues.reduce((a, b) => a + b) / totals.avgHRValues.length)
      : 0

    // Dados para gráficos
    const trendData = cardioLogs.slice().reverse().slice(0, 15).map((log, idx) => {
      const { meta } = parseWorkoutLogMeta(log?.notes)
      return {
        id: idx,
        date: log?.started_at ? new Date(log.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--',
        calories: Number(log?.calories_burned || meta?.estimatedCalories || 0),
        distance: Number(meta?.distanceKm || 0),
        avgHR: Number(meta?.avgHR || 0),
        duration: Number(meta?.durationMin || 0),
      }
    }).reverse()

    const activityData = CARDIO_TYPES.map(type => ({
      name: type.label,
      value: totals.byType[type.id] || 0,
      emoji: type.emoji,
    })).filter(d => d.value > 0)

    const COLORS = ['#FF6200', '#FF8533', '#CC4E00', '#FFB366', '#FF9933', '#FF7722']

    const recent = cardioLogs.slice(0, 10).map(log => {
      const { meta } = parseWorkoutLogMeta(log?.notes)
      const type = meta?.cardioType || 'run'
      const typeLabel = CARDIO_TYPES.find(t => t.id === type)?.label || 'Cardio'
      const distanceKm = Number(meta?.distanceKm || 0)
      const durationMin = Math.max(1, Math.round(Number(meta?.durationMin || log?.duration_seconds / 60 || 0)))
      const calories = Number(log?.calories_burned || meta?.estimatedCalories || 0)
      const avgHR = Number(meta?.avgHR || 0)
      return {
        id: log.id,
        name: typeLabel,
        when: log?.started_at
          ? new Date(log.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '--/--',
        durationMin,
        distanceKm,
        calories,
        avgHR,
      }
    })

    return {
      ...totals,
      avgHR,
      recent,
      trendData,
      activityData,
      COLORS,
    }
  }, [workoutLogs])

  const handleSaveCardio = async () => {
    if (!user?.id) {
      alert('Você precisa estar logado para registrar cardio.')
      return
    }

    const durationMin = Number(cardioForm.durationMin || 0)
    const distanceKm = Number(cardioForm.distanceKm || 0)
    const avgHR = Number(cardioForm.avgHR || 0)

    if (durationMin <= 0) {
      alert('Informe pelo menos o tempo de duração.')
      return
    }

    if (avgHR > 0 && avgHR > maxHR + 20) {
      alert('FC média parece muito alta. Verifique o valor.')
      return
    }

    const durationHours = durationMin / 60
    let calories = caloriesInfo?.calories || 0

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
        calories_burned: calories,
        completion_rate: 100,
        logMeta: {
          sessionType: 'cardio',
          cardioType: cardioForm.type,
          distanceKm,
          durationMin,
          weightKg: userWeight,
          avgHR: Number(cardioForm.avgHR),
          minHR: Number(cardioForm.minHR || 0),
          maxHR: Number(cardioForm.maxHR || 0),
          restingHR,
          userMaxHR: maxHR,
          incline: Number(cardioForm.incline || 0),
          resistance: Number(cardioForm.resistance || 0),
          effort: Number(cardioForm.effort || 5),
          estimatedCalories: calories,
          speedKmh: caloriesInfo?.speedKmh || 0,
          paceMinKm: caloriesInfo?.paceMinKm || 0,
          notes: cardioForm.notes,
          createdBy: 'cardio-monitor',
        },
      })

      setCardioFeedback({
        calories,
        avgHR: Number(cardioForm.avgHR),
        distance: distanceKm,
        duration: durationMin,
      })
      await loadLogs()
      alert(`Cardio registrado! ${calories} kcal queimadas.`)
      setCardioForm({
        type: 'run',
        durationMin: '30',
        distanceKm: '5',
        weightKg: String(userWeight),
        restingHR: String(restingHR),
        avgHR: '',
        minHR: '',
        maxHR: '',
        incline: '0',
        resistance: '0',
        effort: '5',
        notes: '',
      })
    } catch (err) {
      console.error(err)
      alert(`Erro ao registrar: ${err?.message || 'desconhecido'}`)
    } finally {
      setCardioSaving(false)
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="text-jp-orange" size={28} />
          <h1 className="text-[26px] sm:text-[32px] font-semibold text-white">Monitoramento de Cardio</h1>
        </div>
        <p className="text-jp-gray text-sm sm:text-[15px]">Acompanhe frequência cardíaca, calorias e progresso detalhado</p>
      </div>

      {/* Info Cards - FC Máxima e Zonas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-jp-gray text-xs uppercase tracking-wider font-semibold mb-1">Seu Perfil Cardio</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-jp-gray text-sm">Idade:</span>
              <span className="text-white font-semibold">{userAge} anos</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-jp-gray text-sm">FC Máx Estimada:</span>
              <span className="text-jp-orange font-semibold">{maxHR} bpm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-jp-gray text-sm">FC Repouso:</span>
              <span className="text-white font-semibold">{restingHR} bpm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-jp-gray text-sm">Peso:</span>
              <span className="text-white font-semibold">{userWeight} kg</span>
            </div>
          </div>
        </div>

        {/* Zonas de FC */}
        <div className="card md:col-span-2">
          <p className="text-jp-gray text-xs uppercase tracking-wider font-semibold mb-3">Zonas de Treinamento (bpm)</p>
          <div className="space-y-1.5">
            {Object.entries(HR_ZONES).map(([key, zone]) => {
              const minBpm = calculateHRZone(maxHR, restingHR, zone.min)
              const maxBpm = calculateHRZone(maxHR, restingHR, zone.max)
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className={`text-${zone.color}-400`}>{zone.name}:</span>
                  <span className="text-white font-semibold">{minBpm} - {maxBpm} bpm</span>
                  <span className="text-jp-gray text-[10px]">{zone.description}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Formulário de Registro */}
      <div className="card mb-6">
        <h2 className="text-white font-semibold text-lg mb-4">Registrar Sessão de Cardio</h2>
        
        {/* Tipo e Duração */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Tipo de Atividade</label>
            <select
              value={cardioForm.type}
              onChange={e => setCardioForm(prev => ({ ...prev, type: e.target.value }))}
              className="input-dark py-3 text-sm"
            >
              {CARDIO_TYPES.map(item => (
                <option key={item.id} value={item.id}>{item.emoji} {item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Duração (min)</label>
            <input
              type="number"
              min="1"
              value={cardioForm.durationMin}
              onChange={e => setCardioForm(prev => ({ ...prev, durationMin: e.target.value }))}
              className="input-dark py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Distância (km) <span className="normal-case font-normal text-jp-gray/60">— opcional</span></label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={cardioForm.distanceKm}
              onChange={e => setCardioForm(prev => ({ ...prev, distanceKm: e.target.value }))}
              placeholder="0"
              className="input-dark py-3 text-sm"
            />
          </div>
        </div>

        {/* Frequência Cardíaca */}
        <div className="mb-4 p-3 rounded-lg border border-jp-border bg-jp-card-light">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <Heart size={16} className="text-jp-orange" />
              Frequência Cardíaca
            </p>
            <span className="text-[10px] text-jp-gray border border-jp-border rounded px-1.5 py-0.5">opcional</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">FC Repouso (bpm)</label>
              <input
                type="number"
                min="30"
                max="120"
                value={cardioForm.restingHR}
                onChange={e => setCardioForm(prev => ({ ...prev, restingHR: e.target.value }))}
                className="input-dark py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">FC Mínima</label>
              <input
                type="number"
                min="60"
                max={maxHR}
                value={cardioForm.minHR}
                onChange={e => setCardioForm(prev => ({ ...prev, minHR: e.target.value }))}
                placeholder="Ex: 110"
                className="input-dark py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">FC Média</label>
              <input
                type="number"
                min="60"
                max={maxHR + 20}
                value={cardioForm.avgHR}
                onChange={e => setCardioForm(prev => ({ ...prev, avgHR: e.target.value }))}
                placeholder="Ex: 150"
                className="input-dark py-3 text-sm border-jp-orange"
                required
              />
            </div>
            <div>
              <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">FC Máxima</label>
              <input
                type="number"
                min="60"
                max={maxHR + 20}
                value={cardioForm.maxHR}
                onChange={e => setCardioForm(prev => ({ ...prev, maxHR: e.target.value }))}
                placeholder="Ex: 180"
                className="input-dark py-3 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Intensidade e Parâmetros */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Inclinação (%)</label>
            <input
              type="number"
              min="0"
              max="15"
              step="0.5"
              value={cardioForm.incline}
              onChange={e => setCardioForm(prev => ({ ...prev, incline: e.target.value }))}
              className="input-dark py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Resistência</label>
            <input
              type="number"
              min="0"
              max="20"
              value={cardioForm.resistance}
              onChange={e => setCardioForm(prev => ({ ...prev, resistance: e.target.value }))}
              className="input-dark py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Peso (kg)</label>
            <input
              type="number"
              min="30"
              value={cardioForm.weightKg}
              onChange={e => setCardioForm(prev => ({ ...prev, weightKg: e.target.value }))}
              className="input-dark py-3 text-sm"
            />
          </div>
          <div>
            <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Esforço (1-10)</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="10"
                value={cardioForm.effort}
                onChange={e => setCardioForm(prev => ({ ...prev, effort: e.target.value }))}
                className="flex-1"
              />
              <span className="text-white font-semibold w-8 text-center">{cardioForm.effort}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="mb-4">
          <label className="text-jp-gray text-[11px] uppercase tracking-wider font-semibold block mb-2">Notas</label>
          <textarea
            value={cardioForm.notes}
            onChange={e => setCardioForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Como se sentiu? Algo especial?"
            className="input-dark py-3 text-sm h-20"
          />
        </div>

        {/* Análise de FC */}
        {heartRateInfo && (
          <div className={`mb-4 p-3 rounded-lg border ${heartRateInfo.zone ? `border-${heartRateInfo.zone.color}-400 bg-${heartRateInfo.zone.color}-400/10` : 'border-jp-border bg-jp-card-light'}`}>
            <p className="text-white font-semibold text-sm mb-2">Zona de Treino</p>
            {heartRateInfo.zone && (
              <div className="space-y-1">
                <p className="text-white"><span className={`text-${heartRateInfo.zone.color}-400 font-semibold`}>{heartRateInfo.zone.name}</span> ({heartRateInfo.intensity}%)</p>
                <p className="text-jp-gray text-xs">{heartRateInfo.zone.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Preview de Calorias */}
        {caloriesInfo && (
          <div className="rounded-xl border border-jp-border bg-jp-card-light p-4 mb-4">
            <p className="text-white font-semibold text-sm mb-3">Resumo da Sessão</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-jp-gray text-xs mb-1">Calorias</p>
                <p className="text-white font-semibold text-xl">{caloriesInfo.calories}</p>
                <p className="text-jp-gray text-[10px]">kcal</p>
              </div>
              <div>
                <p className="text-jp-gray text-xs mb-1">Velocidade</p>
                <p className="text-white font-semibold text-xl">{caloriesInfo.speedKmh > 0 ? caloriesInfo.speedKmh.toFixed(1) : '—'}</p>
                <p className="text-jp-gray text-[10px]">km/h</p>
              </div>
              <div>
                <p className="text-jp-gray text-xs mb-1">Ritmo</p>
                <p className="text-white font-semibold text-xl">{caloriesInfo.paceMinKm > 0 ? caloriesInfo.paceMinKm.toFixed(1) : '—'}</p>
                <p className="text-jp-gray text-[10px]">min/km</p>
              </div>
              <div className="flex flex-col justify-end">
                <button
                  onClick={handleSaveCardio}
                  disabled={cardioSaving}
                  className="h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-jp-orange hover:bg-jp-orange-dark text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {cardioSaving ? <><LoadingSpinner size="sm" /> Salvando...</> : <><Save size={14} /> Registrar</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {cardioFeedback && (
          <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/30">
            <p className="text-green-400 text-xs font-semibold">✓ Registrado com sucesso!</p>
            <p className="text-green-400/80 text-xs mt-1">{cardioFeedback.calories} kcal • FC: {cardioFeedback.avgHR} bpm • {cardioFeedback.distance.toFixed(1)} km</p>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-jp-gray text-sm mb-2">Sessões</p>
          <p className="text-white font-semibold text-3xl">{cardioPanel.totalSessions}</p>
          <p className="text-jp-gray text-xs mt-1">registradas</p>
        </div>
        <div className="card">
          <p className="text-jp-gray text-sm mb-2">Distância</p>
          <p className="text-white font-semibold text-3xl">{cardioPanel.totalDistanceKm.toFixed(0)}</p>
          <p className="text-jp-gray text-xs mt-1">km</p>
        </div>
        <div className="card">
          <p className="text-jp-gray text-sm mb-2">Tempo</p>
          <p className="text-white font-semibold text-3xl">{Math.round(cardioPanel.totalDurationMin / 60)}</p>
          <p className="text-jp-gray text-xs mt-1">horas</p>
        </div>
        <div className="card">
          <p className="text-jp-gray text-sm mb-2">Calorias</p>
          <p className="text-white font-semibold text-3xl text-jp-orange">{Math.round(cardioPanel.totalCalories)}</p>
          <p className="text-jp-gray text-xs mt-1">kcal</p>
        </div>
      </div>

      {/* FC Média */}
      {cardioPanel.avgHR > 0 && (
        <div className="card mb-6">
          <p className="text-jp-gray text-xs uppercase tracking-wider font-semibold mb-3">FC Média em Sessões</p>
          <p className="text-white font-semibold text-4xl">{cardioPanel.avgHR} <span className="text-sm text-jp-gray">bpm</span></p>
        </div>
      )}

      {/* Gráficos de Análise */}
      {cardioPanel.trendData.length > 0 && (
        <>
          {/* Tendência de Calorias e Distância */}
          <div className="card mb-6">
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <BarChart3 size={18} />
              Tendência de Calorias e Distância
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={cardioPanel.trendData}>
                <defs>
                  <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6200" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#FF6200" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => value.toFixed(0)}
                />
                <Area type="monotone" dataKey="calories" name="Calorias (kcal)" stroke="#FF6200" fill="url(#calorieGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Frequência Cardíaca Média por Sessão */}
          {cardioPanel.trendData.some(d => d.avgHR > 0) && (
            <div className="card mb-6">
              <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                <Heart size={18} className="text-jp-orange" />
                Evolução de FC Média
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cardioPanel.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                  <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => value > 0 ? `${value.toFixed(0)} bpm` : '—'}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', color: '#A0A0A0' }} />
                  <Line type="monotone" dataKey="avgHR" name="FC Média" stroke="#FF6200" strokeWidth={3} dot={{ fill: '#FF6200', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Duração vs Distância */}
          <div className="card mb-6">
            <h3 className="text-white font-semibold text-lg mb-4">Comparação: Duração vs Distância</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cardioPanel.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => value.toFixed(1)}
                />
                <Legend wrapperStyle={{ paddingTop: '20px', color: '#A0A0A0' }} />
                <Bar dataKey="duration" name="Duração (min)" fill="#FF8533" radius={[8, 8, 0, 0]} />
                <Bar dataKey="distance" name="Distância (km)" fill="#FF6200" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição de Atividades */}
          {cardioPanel.activityData.length > 0 && (
            <div className="card mb-6">
              <h3 className="text-white font-semibold text-lg mb-4">Distribuição de Atividades</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={cardioPanel.activityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, emoji }) => `${emoji} ${name} (${value})`}
                    outerRadius={100}
                    fill="#FF6200"
                    dataKey="value"
                  >
                    {cardioPanel.activityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={cardioPanel.COLORS[index % cardioPanel.COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => `${value} sessão${value > 1 ? 's' : ''}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Distribuição por tipo */}
      <div className="card mb-6">
        <h3 className="text-white font-semibold text-lg mb-4">Distribuição por tipo</h3>
        <div className="flex flex-wrap gap-3">
          {CARDIO_TYPES.map(type => (
            <div key={type.id} className="flex-1 min-w-[100px] rounded-lg border border-jp-border bg-jp-card-light p-3 text-center">
              <p className="text-white text-lg mb-1">{type.emoji}</p>
              <p className="text-jp-gray text-xs mb-1">{type.label}</p>
              <p className="text-white font-semibold text-xl">{cardioPanel.byType[type.id] || 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico detalhado */}
      <div className="card">
        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
          <Activity size={18} />
          Histórico de Sessões
        </h3>
        {logsLoading ? (
          <div className="py-8 flex justify-center"><LoadingSpinner size="lg" /></div>
        ) : cardioPanel.recent.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-jp-gray">Nenhuma sessão registrada ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cardioPanel.recent.map(item => (
              <div key={item.id} className="rounded-lg border border-jp-border bg-jp-card-light p-4 hover:border-jp-orange/40 transition-colors">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <p className="text-jp-gray text-xs uppercase tracking-wider mb-1">Atividade</p>
                    <p className="text-white font-semibold">{item.name}</p>
                    <p className="text-jp-gray text-xs mt-1">{item.when}</p>
                  </div>
                  <div>
                    <p className="text-jp-gray text-xs uppercase tracking-wider mb-1">Distância • Tempo</p>
                    <p className="text-white font-semibold">{item.distanceKm.toFixed(1)} km • {item.durationMin} min</p>
                  </div>
                  <div>
                    <p className="text-jp-gray text-xs uppercase tracking-wider mb-1">Calorias</p>
                    <p className="text-jp-orange font-semibold text-lg">{Math.round(item.calories)} kcal</p>
                  </div>
                  <div>
                    <p className="text-jp-gray text-xs uppercase tracking-wider mb-1">FC Média</p>
                    <p className="text-white font-semibold text-lg">{item.avgHR > 0 ? `${item.avgHR} bpm` : '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
