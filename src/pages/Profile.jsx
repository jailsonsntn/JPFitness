import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Save, Scale, Ruler, Calendar, Target, Activity,
  Flame, CheckCircle2, ArrowLeft, Loader
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { upsertProfile, createMeasurement } from '../services/dbService'
import LoadingSpinner from '../components/LoadingSpinner'

const GOALS = [
  { id: 'weight_loss', label: 'Perda de gordura', emoji: '🔥', cal: 1800 },
  { id: 'muscle_gain', label: 'Ganho de massa', emoji: '💪', cal: 2800 },
  { id: 'maintenance', label: 'Manutenção', emoji: '⚖️', cal: 2200 },
  { id: 'performance', label: 'Performance', emoji: '⚡', cal: 2600 },
]

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentário', sub: 'Pouco ou nenhum exercício' },
  { id: 'light', label: 'Leve', sub: '1-3 dias de exercício por semana' },
  { id: 'moderate', label: 'Moderado', sub: '3-5 dias de exercício por semana' },
  { id: 'active', label: 'Ativo', sub: '6-7 dias de exercício por semana' },
  { id: 'very_active', label: 'Muito Ativo', sub: 'Treino 2x ao dia ou trabalho físico pesado' },
]

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    username: profile?.username || '',
    goal: profile?.goal || 'maintenance',
    activity_level: profile?.activity_level || 'moderate',
    weight_kg: profile?.weight_kg || '',
    height_cm: profile?.height_cm || '',
    age: profile?.age || '',
    daily_calorie_goal: profile?.daily_calorie_goal || 2000,
  })

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await upsertProfile({
        id: user.id,
        full_name: form.full_name,
        username: form.username || null,
        goal: form.goal,
        activity_level: form.activity_level,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        age: form.age ? parseInt(form.age) : null,
        daily_calorie_goal: parseInt(form.daily_calorie_goal) || 2000,
      })

      // Salvar medição se peso/altura fornecidos
      if (form.weight_kg && form.height_cm) {
        await createMeasurement({
          user_id: user.id,
          weight_kg: parseFloat(form.weight_kg),
          height_cm: parseFloat(form.height_cm),
        }).catch(() => {}) // silencioso se falhar
      }

      await refreshProfile()
      setSaved(true)
      setTimeout(() => { setSaved(false); navigate('/dashboard') }, 1500)
    } catch (err) {
      setError(err.message || 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // Calcular meta calórica automaticamente
  const calcCalories = () => {
    const w = parseFloat(form.weight_kg)
    const h = parseFloat(form.height_cm)
    const a = parseInt(form.age)
    if (!w || !h || !a) return
    // Mifflin-St Jeor (masculino base, ajuste por objetivo)
    const bmr = 10 * w + 6.25 * h - 5 * a + 5
    const activityMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
    const tdee = Math.round(bmr * (activityMult[form.activity_level] || 1.55))
    const adjustments = { weight_loss: -400, muscle_gain: +300, maintenance: 0, performance: +200 }
    const cal = tdee + (adjustments[form.goal] || 0)
    setForm(f => ({ ...f, daily_calorie_goal: cal }))
  }

  return (
    <div className="page-container max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-jp-card border border-jp-border text-jp-gray hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white">Meu Perfil</h1>
          <p className="text-jp-gray">Configure seus dados para personalizar a experiência</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Personal info */}
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <User size={18} className="text-jp-orange" />
            Informações Pessoais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Nome completo</label>
              <input type="text" value={form.full_name} onChange={set('full_name')} className="input-dark" placeholder="Seu nome" />
            </div>
            <div>
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Usuário (opcional)</label>
              <input type="text" value={form.username} onChange={set('username')} className="input-dark" placeholder="@usuario" />
            </div>
            <div>
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">E-mail</label>
              <input type="email" value={user?.email || ''} disabled className="input-dark opacity-50 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Idade</label>
              <input type="number" value={form.age} onChange={set('age')} className="input-dark" placeholder="Anos" min="10" max="100" />
            </div>
          </div>
        </div>

        {/* Body data */}
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Scale size={18} className="text-jp-orange" />
            Dados Corporais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Peso atual (kg)</label>
              <input type="number" value={form.weight_kg} onChange={set('weight_kg')} className="input-dark" placeholder="Ex: 75.5" step="0.1" min="30" max="300" />
            </div>
            <div>
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Altura (cm)</label>
              <input type="number" value={form.height_cm} onChange={set('height_cm')} className="input-dark" placeholder="Ex: 175" min="100" max="250" />
            </div>
          </div>
        </div>

        {/* Goal */}
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target size={18} className="text-jp-orange" />
            Meu Objetivo
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GOALS.map(goal => (
              <button
                key={goal.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, goal: goal.id }))}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  form.goal === goal.id
                    ? 'bg-jp-orange/20 border-jp-orange text-white'
                    : 'bg-jp-card-light border-jp-border text-jp-gray hover:border-jp-orange/40'
                }`}
              >
                <span className="text-2xl">{goal.emoji}</span>
                <span className="text-xs font-semibold text-center leading-tight">{goal.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Activity level */}
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity size={18} className="text-jp-orange" />
            Nível de Atividade
          </h2>
          <div className="space-y-2">
            {ACTIVITY_LEVELS.map(level => (
              <button
                key={level.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, activity_level: level.id }))}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  form.activity_level === level.id
                    ? 'bg-jp-orange/20 border-jp-orange'
                    : 'bg-jp-card-light border-jp-border hover:border-jp-orange/40'
                }`}
              >
                <div>
                  <p className={`font-semibold text-sm ${form.activity_level === level.id ? 'text-white' : 'text-jp-gray-light'}`}>
                    {level.label}
                  </p>
                  <p className="text-jp-gray text-xs">{level.sub}</p>
                </div>
                {form.activity_level === level.id && (
                  <CheckCircle2 size={18} className="text-jp-orange flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Calorie goal */}
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Flame size={18} className="text-jp-orange" />
            Meta Calórica Diária
          </h2>
          <p className="text-jp-gray text-sm mb-4">
            Preencha peso, altura, idade e objetivo para calcular automaticamente.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-jp-gray text-xs font-semibold uppercase tracking-wider block mb-2">Kcal por dia</label>
              <input
                type="number"
                value={form.daily_calorie_goal}
                onChange={set('daily_calorie_goal')}
                className="input-dark"
                min="1000"
                max="6000"
              />
            </div>
            <button
              type="button"
              onClick={calcCalories}
              className="btn-secondary py-3 flex-shrink-0"
            >
              Calcular
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={saving || saved}
          className="btn-primary w-full justify-center text-base py-4 disabled:opacity-70"
        >
          {saved ? (
            <><CheckCircle2 size={18} className="text-green-300" /> Perfil salvo!</>
          ) : saving ? (
            <><LoadingSpinner size="sm" /> Salvando...</>
          ) : (
            <><Save size={18} /> Salvar Perfil</>
          )}
        </button>
      </form>
    </div>
  )
}
