import { useState, useEffect } from 'react'
import {
  Apple, Plus, Trash2, Search, Zap, ChevronDown, ChevronUp,
  Calendar, Target, TrendingUp, Info, X, Loader
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { analyzeMeal, generateMealPlan, getNutritionTip } from '../services/geminiApi'
import { useAuth } from '../context/AuthContext'
import { getFoodLogs, createFoodLog, deleteFoodLog } from '../services/dbService'

const GOALS = [
  { id: 'weight_loss', label: 'Perda de peso', emoji: '🔥', calories: 1800 },
  { id: 'muscle_gain', label: 'Ganho de massa', emoji: '💪', calories: 2800 },
  { id: 'maintenance', label: 'Manutenção', emoji: '⚖️', calories: 2200 },
  { id: 'performance', label: 'Performance', emoji: '⚡', calories: 2600 },
]

function MacroCard({ label, value, goal, color, unit }) {
  const pct = Math.min(Math.round((value / goal) * 100), 100)
  const radius = 30
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="card flex flex-col items-center text-center">
      <div className="relative w-20 h-20 mb-3">
        <svg width="80" height="80" className="rotate-[-90deg]">
          <circle cx="40" cy="40" r={radius} stroke="#2A2A2A" strokeWidth="6" fill="none" />
          <circle
            cx="40" cy="40" r={radius}
            stroke={color} strokeWidth="6" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{pct}%</span>
        </div>
      </div>
      <p className="text-white font-bold text-lg">{value}<span className="text-jp-gray text-sm font-normal">{unit}</span></p>
      <p className="text-jp-gray text-xs mb-1">{label}</p>
      <p className="text-xs font-medium" style={{ color }}>Meta: {goal}{unit}</p>
    </div>
  )
}

function MealAnalysisModal({ result, onClose }) {
  if (!result) return null

  const ratingColor = result.rating >= 8 ? '#10B981' : result.rating >= 5 ? '#FF6200' : '#EF4444'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-jp-card border border-jp-border rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-jp-card border-b border-jp-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Análise Nutricional</h2>
          <button onClick={onClose} className="text-jp-gray hover:text-white p-1">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Meal name + rating */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-jp-gray mb-1">Refeição analisada</p>
              <h3 className="text-white font-bold text-lg capitalize">{result.name}</h3>
              <p className="text-jp-gray text-sm mt-1">{result.summary}</p>
            </div>
            <div
              className="flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center"
              style={{ background: `${ratingColor}20`, border: `1px solid ${ratingColor}40` }}
            >
              <span className="text-lg font-black" style={{ color: ratingColor }}>{result.rating}</span>
              <span className="text-xs text-jp-gray">/10</span>
            </div>
          </div>

          {/* Macros grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Calorias', value: result.calories, unit: 'kcal', color: '#FF6200' },
              { label: 'Proteína', value: result.protein, unit: 'g', color: '#3B82F6' },
              { label: 'Carboidratos', value: result.carbs, unit: 'g', color: '#F59E0B' },
              { label: 'Gordura', value: result.fat, unit: 'g', color: '#10B981' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-jp-card-light rounded-xl p-3 border border-jp-border">
                <p className="text-xs text-jp-gray mb-1">{label}</p>
                <p className="font-bold" style={{ color }}>
                  {value} <span className="text-jp-gray font-normal text-sm">{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Fibra */}
          {result.fiber > 0 && (
            <div className="bg-jp-card-light rounded-xl p-3 border border-jp-border">
              <p className="text-xs text-jp-gray mb-1">Fibras</p>
              <p className="font-bold text-green-400">{result.fiber} <span className="text-jp-gray font-normal text-sm">g</span></p>
            </div>
          )}

          {/* Tips */}
          {result.tips?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-jp-orange uppercase tracking-wider mb-2">Dicas</p>
              <div className="space-y-2">
                {result.tips.map((tip, i) => (
                  <div key={i} className="flex gap-2 text-sm text-jp-gray-light">
                    <span className="text-jp-orange flex-shrink-0">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Nutrition() {
  const { user, profile } = useAuth()
  const [selectedGoal, setSelectedGoal] = useState(GOALS[0])
  const [foodInput, setFoodInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [foodLog, setFoodLog] = useState([])
  const [mealPlan, setMealPlan] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [tip, setTip] = useState('')
  const [tipLoading, setTipLoading] = useState(true)
  const [restrictions, setRestrictions] = useState('')
  const [showPlanForm, setShowPlanForm] = useState(false)

  const calorieGoal = profile?.daily_calorie_goal || selectedGoal.calories

  const totals = foodLog.reduce((acc, item) => ({
    calories: acc.calories + (item.calories || 0),
    protein: acc.protein + (parseFloat(item.protein_g || item.protein) || 0),
    carbs: acc.carbs + (parseFloat(item.carbs_g || item.carbs) || 0),
    fat: acc.fat + (parseFloat(item.fat_g || item.fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  useEffect(() => {
    if (!user) return
    getFoodLogs(user.id).then(logs => setFoodLog(logs)).catch(console.error)
  }, [user])

  useEffect(() => {
    getNutritionTip(selectedGoal.label)
      .then(t => setTip(t))
      .catch(() => setTip('Mantenha uma dieta equilibrada com proteínas, carboidratos e gorduras saudáveis.'))
      .finally(() => setTipLoading(false))
  }, [selectedGoal])

  const handleAnalyzeMeal = async () => {
    if (!foodInput.trim() || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeMeal(foodInput)
      setAnalysisResult(result)
      const newLog = {
        user_id: user?.id,
        meal_name: result.name || foodInput,
        description: foodInput,
        calories: result.calories,
        protein_g: result.protein,
        carbs_g: result.carbs,
        fat_g: result.fat,
        fiber_g: result.fiber,
        logged_at: new Date().toISOString(),
      }
      if (user) {
        const saved = await createFoodLog(newLog)
        setFoodLog(prev => [...prev, saved])
      } else {
        setFoodLog(prev => [...prev, { ...newLog, id: Date.now() }])
      }
      setFoodInput('')
    } catch {
      alert('Erro ao analisar refeição. Tente novamente.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleGeneratePlan = async () => {
    setPlanLoading(true)
    try {
      const plan = await generateMealPlan({
        goal: selectedGoal.label,
        calories: selectedGoal.calories,
        restrictions
      })
      setMealPlan(plan)
    } catch {
      setMealPlan('Erro ao gerar plano alimentar. Tente novamente.')
    } finally {
      setPlanLoading(false)
    }
  }

  const removeFromLog = async (id) => {
    if (user) {
      await deleteFoodLog(id).catch(console.error)
    }
    setFoodLog(prev => prev.filter(item => item.id !== id))
  }

  return (
    <div className="page-container pt-24">
      {analysisResult && (
        <MealAnalysisModal result={analysisResult} onClose={() => setAnalysisResult(null)} />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Nutrição Inteligente</h1>
        <p className="text-jp-gray">Acompanhe suas refeições e receba análises com IA Gemini</p>
      </div>

      {/* Goal selector */}
      <div className="card mb-8">
        <p className="text-sm font-semibold text-jp-gray uppercase tracking-wider mb-3">Meu Objetivo</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GOALS.map(goal => (
            <button
              key={goal.id}
              onClick={() => setSelectedGoal(goal)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                selectedGoal.id === goal.id
                  ? 'bg-jp-orange/20 border-jp-orange text-white'
                  : 'bg-jp-card-light border-jp-border text-jp-gray hover:border-jp-orange/40 hover:text-white'
              }`}
            >
              <span className="text-2xl">{goal.emoji}</span>
              <span className="text-xs font-semibold text-center leading-tight">{goal.label}</span>
              <span className="text-xs text-jp-gray">{goal.calories} kcal</span>
            </button>
          ))}
        </div>

        {/* AI tip */}
        <div className="mt-4 flex items-start gap-3 bg-jp-card-light rounded-xl p-3 border border-jp-border">
          <Zap size={16} className="text-jp-orange flex-shrink-0 mt-0.5" />
          {tipLoading ? (
            <LoadingSpinner size="sm" text="Carregando dica..." />
          ) : (
            <p className="text-jp-gray-light text-sm italic">{tip}</p>
          )}
        </div>
      </div>

      {/* Macro overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MacroCard label="Calorias" value={Math.round(totals.calories)} goal={calorieGoal} color="#FF6200" unit=" kcal" />
        <MacroCard label="Proteína" value={Math.round(totals.protein)} goal={Math.round(calorieGoal * 0.3 / 4)} color="#3B82F6" unit="g" />
        <MacroCard label="Carboidratos" value={Math.round(totals.carbs)} goal={Math.round(calorieGoal * 0.45 / 4)} color="#F59E0B" unit="g" />
        <MacroCard label="Gordura" value={Math.round(totals.fat)} goal={Math.round(calorieGoal * 0.25 / 9)} color="#10B981" unit="g" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Food log */}
        <div className="lg:col-span-3 space-y-4">
          {/* Add meal */}
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Apple size={20} className="text-jp-orange" />
              Registrar Refeição
            </h2>
            <p className="text-jp-gray text-sm mb-3">
              Descreva sua refeição e a IA Gemini analisará as informações nutricionais.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Ex: 200g frango grelhado com arroz integral e brócolis..."
                value={foodInput}
                onChange={e => setFoodInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyzeMeal()}
                className="input-dark flex-1"
                disabled={analyzing}
              />
              <button
                onClick={handleAnalyzeMeal}
                disabled={!foodInput.trim() || analyzing}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {analyzing ? <LoadingSpinner size="sm" /> : <><Zap size={16} /> Analisar</>}
              </button>
            </div>
            <p className="text-xs text-jp-gray mt-2">
              💡 Seja específico (porções, métodos de preparo) para resultados mais precisos
            </p>
          </div>

          {/* Log list */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Diário de Hoje</h2>
              <div className="flex items-center gap-1.5 text-jp-gray text-sm">
                <Calendar size={14} />
                {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
              </div>
            </div>
            {foodLog.length === 0 ? (
              <div className="text-center py-8 text-jp-gray">
                <Apple size={32} className="mx-auto mb-2 opacity-30" />
                <p>Nenhuma refeição registrada hoje</p>
              </div>
            ) : (
              <div className="space-y-3">
                {foodLog.map(item => (
                  <div key={item.id} className="flex gap-3 p-3 bg-jp-card-light border border-jp-border rounded-xl group">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm capitalize">{item.meal_name || item.name}</p>
                      <p className="text-jp-gray text-xs truncate mt-0.5">{item.description || item.items}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-jp-orange font-semibold">{item.calories} kcal</span>
                        <span className="text-xs text-blue-400">P: {Math.round(item.protein_g || item.protein || 0)}g</span>
                        <span className="text-xs text-yellow-400">C: {Math.round(item.carbs_g || item.carbs || 0)}g</span>
                        <span className="text-xs text-green-400">G: {Math.round(item.fat_g || item.fat || 0)}g</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromLog(item.id)}
                      className="text-jp-gray hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* Totals */}
                <div className="flex gap-4 pt-3 mt-3 border-t border-jp-border">
                  <div className="text-center flex-1">
                    <p className="text-jp-orange font-bold">{totals.calories}</p>
                    <p className="text-jp-gray text-xs">kcal total</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-blue-400 font-bold">{totals.protein}g</p>
                    <p className="text-jp-gray text-xs">proteína</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-yellow-400 font-bold">{totals.carbs}g</p>
                    <p className="text-jp-gray text-xs">carboidratos</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-green-400 font-bold">{totals.fat}g</p>
                    <p className="text-jp-gray text-xs">gordura</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Meal plan generator */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Zap size={18} className="text-jp-orange" />
              Plano Alimentar IA
            </h2>
            <p className="text-jp-gray text-sm mb-4">
              Gere um plano alimentar completo para o dia com o Gemini AI.
            </p>

            <button
              onClick={() => setShowPlanForm(!showPlanForm)}
              className="w-full flex items-center justify-between text-jp-gray-light text-sm border border-jp-border rounded-xl px-4 py-3 hover:border-jp-orange/40 hover:text-white transition-all mb-3"
            >
              <span>Restrições alimentares (opcional)</span>
              {showPlanForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showPlanForm && (
              <input
                type="text"
                placeholder="Ex: sem lactose, vegetariano, sem glúten..."
                value={restrictions}
                onChange={e => setRestrictions(e.target.value)}
                className="input-dark mb-3"
              />
            )}

            <button
              onClick={handleGeneratePlan}
              disabled={planLoading}
              className="btn-primary w-full justify-center disabled:opacity-40"
            >
              {planLoading ? (
                <><LoadingSpinner size="sm" /> Gerando com Gemini...</>
              ) : (
                <><Zap size={16} /> Gerar Plano para {selectedGoal.label}</>
              )}
            </button>

            {mealPlan && (
              <div className="mt-4 bg-jp-card-light border border-jp-border rounded-xl p-4 max-h-[500px] overflow-y-auto">
                <p className="text-xs font-semibold text-jp-orange uppercase tracking-wider mb-3">
                  Plano Alimentar • {selectedGoal.label}
                </p>
                <div
                  className="text-sm text-jp-gray-light leading-relaxed whitespace-pre-wrap"
                  style={{ fontSize: '13px' }}
                >
                  {mealPlan}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
