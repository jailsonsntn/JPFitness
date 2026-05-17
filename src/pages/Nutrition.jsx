import { useState, useEffect } from 'react'
import { Apple, Trash2, Calendar, Plus } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { getFoodLogs, createFoodLog, deleteFoodLog } from '../services/dbService'
import { analyzeNutritionWithPython } from '../services/pythonApi'

const GOALS = [
  { id: 'weight_loss', label: 'Perda de peso', emoji: '🔥', calories: 1800 },
  { id: 'muscle_gain', label: 'Ganho de massa', emoji: '💪', calories: 2800 },
  { id: 'maintenance', label: 'Manutenção', emoji: '⚖️', calories: 2200 },
  { id: 'performance', label: 'Performance', emoji: '⚡', calories: 2600 },
]

function createEmptyIngredient() {
  return {
    name: '',
    quantityG: '100',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
  }
}

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

function sumIngredients(ingredients) {
  return ingredients.reduce(
    (acc, item) => ({
      calories: acc.calories + (parseFloat(item.calories) || 0),
      protein: acc.protein + (parseFloat(item.protein) || 0),
      carbs: acc.carbs + (parseFloat(item.carbs) || 0),
      fat: acc.fat + (parseFloat(item.fat) || 0),
      fiber: acc.fiber + (parseFloat(item.fiber) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )
}

export default function Nutrition() {
  const { user, profile } = useAuth()
  const [selectedGoal, setSelectedGoal] = useState(GOALS[0])
  const [mealName, setMealName] = useState('')
  const [ingredients, setIngredients] = useState([createEmptyIngredient()])
  const [manualSaving, setManualSaving] = useState(false)
  const [foodLog, setFoodLog] = useState([])
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [pythonAnalysis, setPythonAnalysis] = useState(null)

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

  const updateIngredient = (index, field, value) => {
    setIngredients(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const addIngredient = () => {
    setIngredients(prev => [...prev, createEmptyIngredient()])
  }

  const removeIngredient = (index) => {
    setIngredients(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [createEmptyIngredient()]
    })
  }

  const handleAddManualMeal = async () => {
    if (manualSaving) return

    const validIngredients = ingredients.filter(item => item.name.trim())
    if (validIngredients.length === 0) {
      alert('Adicione pelo menos 1 alimento.')
      return
    }

    const approx = sumIngredients(validIngredients)
    const payload = {
      user_id: user?.id,
      meal_name: mealName.trim() || 'Refeição manual',
      description: validIngredients
        .map(item => `${item.name} (${item.quantityG || 100}g)`)
        .join(', '),
      calories: Math.max(0, Math.round(approx.calories)),
      protein_g: Math.max(0, Math.round(approx.protein * 10) / 10),
      carbs_g: Math.max(0, Math.round(approx.carbs * 10) / 10),
      fat_g: Math.max(0, Math.round(approx.fat * 10) / 10),
      fiber_g: Math.max(0, Math.round(approx.fiber * 10) / 10),
    }

    setManualSaving(true)
    try {
      if (user) {
        const saved = await createFoodLog(payload)
        setFoodLog(prev => [...prev, saved])
      } else {
        setFoodLog(prev => [...prev, { ...payload, id: Date.now() }])
      }

      setMealName('')
      setIngredients([createEmptyIngredient()])
    } catch {
      alert('Erro ao salvar refeição manual.')
    } finally {
      setManualSaving(false)
    }
  }

  const handleAnalyzeWithPython = async () => {
    if (analysisLoading) return

    const validIngredients = ingredients
      .filter(item => item.name.trim())
      .map(item => ({
        name: item.name,
        quantity_g: Math.max(1, parseFloat(item.quantityG) || 100),
        calories: Math.max(0, parseFloat(item.calories) || 0),
        protein: Math.max(0, parseFloat(item.protein) || 0),
        carbs: Math.max(0, parseFloat(item.carbs) || 0),
        fat: Math.max(0, parseFloat(item.fat) || 0),
        fiber: Math.max(0, parseFloat(item.fiber) || 0),
      }))

    if (!validIngredients.length) {
      alert('Adicione pelo menos 1 alimento antes de analisar.')
      return
    }

    setAnalysisLoading(true)
    try {
      const analysis = await analyzeNutritionWithPython({
        goal: selectedGoal.label,
        ingredients: validIngredients,
      })
      setPythonAnalysis(analysis)
    } catch {
      alert('Nao foi possivel analisar com o motor Python agora.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  const currentApprox = sumIngredients(ingredients)

  const removeFromLog = async (id) => {
    if (user) {
      await deleteFoodLog(id).catch(console.error)
    }
    setFoodLog(prev => prev.filter(item => item.id !== id))
  }

  return (
    <div className="page-container pt-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Nutrição Inteligente</h1>
        <p className="text-jp-gray">Registre alimentos manualmente e calcule macros aproximados por refeição.</p>
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

        <div className="mt-4 bg-jp-card-light rounded-xl p-3 border border-jp-border">
          <p className="text-sm text-jp-gray-light">
            Dica: preencha calorias e macros de cada alimento para ter um total aproximado mais fiel.
          </p>
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
          {/* Add meal manual */}
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Apple size={20} className="text-jp-orange" />
              Registrar Refeição Manual
            </h2>
            <div className="mb-3">
              <input
                type="text"
                value={mealName}
                onChange={e => setMealName(e.target.value)}
                placeholder="Nome da refeição (ex: Almoço)"
                className="input-dark"
              />
            </div>

            <div className="space-y-3 mb-4">
              {ingredients.map((item, index) => (
                <div key={index} className="border border-jp-border rounded-xl p-3 bg-jp-card-light">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => updateIngredient(index, 'name', e.target.value)}
                      placeholder="Alimento (ex: arroz cozido)"
                      className="input-dark"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantityG}
                      onChange={e => updateIngredient(index, 'quantityG', e.target.value)}
                      placeholder="Quantidade (g)"
                      className="input-dark"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                    <input
                      type="number"
                      min="0"
                      value={item.calories}
                      onChange={e => updateIngredient(index, 'calories', e.target.value)}
                      placeholder="kcal"
                      className="input-dark"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.protein}
                      onChange={e => updateIngredient(index, 'protein', e.target.value)}
                      placeholder="Prot (g)"
                      className="input-dark"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.carbs}
                      onChange={e => updateIngredient(index, 'carbs', e.target.value)}
                      placeholder="Carb (g)"
                      className="input-dark"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.fat}
                      onChange={e => updateIngredient(index, 'fat', e.target.value)}
                      placeholder="Gord (g)"
                      className="input-dark"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.fiber}
                      onChange={e => updateIngredient(index, 'fiber', e.target.value)}
                      placeholder="Fibra (g)"
                      className="input-dark"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => removeIngredient(index)}
                      className="text-xs text-jp-gray hover:text-red-400"
                    >
                      Remover alimento
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addIngredient} className="btn-secondary w-full justify-center mb-3">
              <Plus size={14} /> Adicionar alimento
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
              <div className="rounded-lg border border-jp-border p-2 text-center bg-jp-card-light">
                <p className="text-xs text-jp-gray">kcal</p>
                <p className="text-sm text-jp-orange font-semibold">{Math.round(currentApprox.calories)}</p>
              </div>
              <div className="rounded-lg border border-jp-border p-2 text-center bg-jp-card-light">
                <p className="text-xs text-jp-gray">Prot</p>
                <p className="text-sm text-blue-400 font-semibold">{currentApprox.protein.toFixed(1)}g</p>
              </div>
              <div className="rounded-lg border border-jp-border p-2 text-center bg-jp-card-light">
                <p className="text-xs text-jp-gray">Carb</p>
                <p className="text-sm text-yellow-400 font-semibold">{currentApprox.carbs.toFixed(1)}g</p>
              </div>
              <div className="rounded-lg border border-jp-border p-2 text-center bg-jp-card-light">
                <p className="text-xs text-jp-gray">Gord</p>
                <p className="text-sm text-green-400 font-semibold">{currentApprox.fat.toFixed(1)}g</p>
              </div>
              <div className="rounded-lg border border-jp-border p-2 text-center bg-jp-card-light">
                <p className="text-xs text-jp-gray">Fibra</p>
                <p className="text-sm text-white font-semibold">{currentApprox.fiber.toFixed(1)}g</p>
              </div>
            </div>

            <button
              onClick={handleAddManualMeal}
              disabled={manualSaving}
              className="btn-primary w-full justify-center disabled:opacity-40"
            >
              {manualSaving ? <LoadingSpinner size="sm" /> : 'Salvar refeição manual'}
            </button>

            <button
              onClick={handleAnalyzeWithPython}
              disabled={analysisLoading}
              className="btn-secondary w-full justify-center mt-2 disabled:opacity-40"
            >
              {analysisLoading ? <LoadingSpinner size="sm" /> : 'Analisar com Motor Python'}
            </button>
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

        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-bold text-white mb-3">Resumo Aproximado da Refeição Atual</h2>
            <p className="text-jp-gray text-sm mb-4">
              Os valores abaixo sao aproximados e baseados no preenchimento manual de cada alimento.
            </p>

            <div className="space-y-2">
              {ingredients.filter(item => item.name.trim()).length === 0 ? (
                <p className="text-sm text-jp-gray">Adicione alimentos para ver o calculo aproximado.</p>
              ) : (
                ingredients
                  .filter(item => item.name.trim())
                  .map((item, index) => (
                    <div key={index} className="p-3 rounded-xl border border-jp-border bg-jp-card-light">
                      <p className="text-sm text-white font-semibold">{item.name}</p>
                      <p className="text-xs text-jp-gray mt-1">
                        {item.quantityG || 100}g • {item.calories || 0} kcal • P {item.protein || 0}g • C {item.carbs || 0}g • G {item.fat || 0}g
                      </p>
                    </div>
                  ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-jp-border grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-jp-border p-3 bg-jp-card-light">
                <p className="text-xs text-jp-gray">Calorias</p>
                <p className="text-lg text-jp-orange font-bold">{Math.round(currentApprox.calories)} kcal</p>
              </div>
              <div className="rounded-lg border border-jp-border p-3 bg-jp-card-light">
                <p className="text-xs text-jp-gray">Proteina</p>
                <p className="text-lg text-blue-400 font-bold">{currentApprox.protein.toFixed(1)} g</p>
              </div>
              <div className="rounded-lg border border-jp-border p-3 bg-jp-card-light">
                <p className="text-xs text-jp-gray">Carboidratos</p>
                <p className="text-lg text-yellow-400 font-bold">{currentApprox.carbs.toFixed(1)} g</p>
              </div>
              <div className="rounded-lg border border-jp-border p-3 bg-jp-card-light">
                <p className="text-xs text-jp-gray">Gordura</p>
                <p className="text-lg text-green-400 font-bold">{currentApprox.fat.toFixed(1)} g</p>
              </div>
            </div>

            {pythonAnalysis && (
              <div className="mt-4 pt-4 border-t border-jp-border">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-white">Analise Python</h3>
                  <span className="text-xs px-2 py-1 rounded-lg border border-jp-border text-jp-gray-light">
                    Score {pythonAnalysis.rating}/10
                  </span>
                </div>
                <p className="text-xs text-jp-gray mb-2">{pythonAnalysis.summary}</p>
                <p className="text-xs text-jp-gray mb-2">
                  Faixa de kcal para objetivo: {pythonAnalysis.calorie_target?.min} - {pythonAnalysis.calorie_target?.max}
                </p>
                <div className="space-y-1">
                  {(pythonAnalysis.tips || []).map((tip, idx) => (
                    <p key={idx} className="text-xs text-jp-gray-light">• {tip}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
