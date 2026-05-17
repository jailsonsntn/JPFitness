import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight, X, Dumbbell, Info, Target } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { getExercises, getExerciseCategories, searchExercises } from '../services/wgerApi'

const CATEGORIES = [
  { id: null, name: 'Todos' },
  { id: 10, name: 'Abdômen' },
  { id: 8, name: 'Braços' },
  { id: 12, name: 'Costas' },
  { id: 14, name: 'Panturrilha' },
  { id: 15, name: 'Cardio' },
  { id: 11, name: 'Peito' },
  { id: 9, name: 'Pernas' },
  { id: 13, name: 'Ombros' },
]

const CATEGORY_COLORS = {
  10: 'text-green-400 bg-green-400/10',
  8: 'text-blue-400 bg-blue-400/10',
  12: 'text-yellow-400 bg-yellow-400/10',
  14: 'text-pink-400 bg-pink-400/10',
  15: 'text-red-400 bg-red-400/10',
  11: 'text-jp-orange bg-jp-orange/10',
  9: 'text-purple-400 bg-purple-400/10',
  13: 'text-cyan-400 bg-cyan-400/10',
}

const PT_LANGUAGE_ID = 7
const translationCache = new Map()

const TERM_TRANSLATIONS = {
  Quads: 'Quadríceps',
  Shoulders: 'Ombros',
  Glutes: 'Glúteos',
  Abs: 'Abdômen',
  'Obliquus externus abdominis': 'Oblíquo externo',
  'none (bodyweight exercise)': 'Nenhum (exercício com peso corporal)',
  None: 'Nenhum',
  Cardio: 'Cardio',
}

function translateTerm(value) {
  if (!value) return ''
  return TERM_TRANSLATIONS[value] || value
}

function looksLikeEnglish(text = '') {
  return /\b(the|with|and|grab|lean|body|exercise|none|arms|legs|core|shoulders|glutes|abs|biceps|triceps|step|jump|hold|while|your|this|is|for|to|of|in|on)\b/i.test(text)
}

async function translateToPtBr(text, force = false) {
  const input = (text || '').trim()
  if (!input) return ''

  const fromDictionary = translateTerm(input)
  if (fromDictionary !== input) return fromDictionary

  if (!force && !looksLikeEnglish(input)) return input
  if (translationCache.has(input)) return translationCache.get(input)

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(input)}&langpair=en|pt-BR`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Translation request failed')
    const data = await response.json()
    const translated = data?.responseData?.translatedText?.trim() || input
    translationCache.set(input, translated)
    return translated
  } catch {
    translationCache.set(input, input)
    return input
  }
}

async function translateListToPtBr(list = [], force = false) {
  return Promise.all((list || []).map(item => translateToPtBr(item, force)))
}

function getCategoryName(categoryId, fallback = '') {
  return CATEGORIES.find(c => c.id === categoryId)?.name || translateTerm(fallback)
}

function getPtTranslation(exercise) {
  const translations = exercise?.translations || []
  return (
    translations.find(t => t.language === PT_LANGUAGE_ID) ||
    translations.find(t => t.language === 2) ||
    translations[0]
  )
}

function sanitizeDescription(raw = '') {
  const text = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.replace(/Notes\s*\(Instructions\)\s*[:,]?\s*/gi, '')
}

function ExerciseModal({ exercise, onClose }) {
  const translation = getPtTranslation(exercise)
  const baseName = translation?.name || 'Exercício'
  const baseDescription = sanitizeDescription(translation?.description) || 'Sem descrição disponível.'
  const baseMuscles = exercise.muscles?.map(m => m.name || m.name_en).filter(Boolean) || []
  const baseMusclesSecondary = exercise.muscles_secondary?.map(m => m.name || m.name_en).filter(Boolean) || []
  const baseEquipment = exercise.equipment?.map(e => e.name).filter(Boolean) || []
  const [translated, setTranslated] = useState({
    name: baseName,
    description: baseDescription,
    muscles: baseMuscles.map(translateTerm),
    musclesSecondary: baseMusclesSecondary.map(translateTerm),
    equipment: baseEquipment.map(translateTerm),
  })

  useEffect(() => {
    let cancelled = false

    if (!exercise) {
      setTranslated({
        name: 'Exercício',
        description: 'Sem descrição disponível.',
        muscles: [],
        musclesSecondary: [],
        equipment: [],
      })
      return () => { cancelled = true }
    }

    const run = async () => {
      const force = translation?.language !== PT_LANGUAGE_ID
      const [name, description, muscles, musclesSecondary, equipment] = await Promise.all([
        translateToPtBr(baseName, force),
        translateToPtBr(baseDescription, force),
        translateListToPtBr(baseMuscles, force),
        translateListToPtBr(baseMusclesSecondary, force),
        translateListToPtBr(baseEquipment, force),
      ])

      if (cancelled) return
      setTranslated({ name, description, muscles, musclesSecondary, equipment })
    }

    run()
    return () => { cancelled = true }
  }, [exercise?.id, baseName, baseDescription])

  if (!exercise) return null

  const name = translated.name
  const description = translated.description
  const muscles = translated.muscles
  const musclesSecondary = translated.musclesSecondary
  const equipment = translated.equipment
  const category = getCategoryName(exercise.category?.id, exercise.category?.name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative bg-jp-card border border-jp-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-card-hover"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-jp-card border-b border-jp-border p-6 flex items-start justify-between">
          <div>
            <span className={`badge text-xs mb-2 inline-block ${CATEGORY_COLORS[exercise.category?.id] || 'text-jp-gray bg-jp-border'}`}>
              {category}
            </span>
            <h2 className="text-2xl font-bold text-white">{name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-jp-border text-jp-gray hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-jp-orange uppercase tracking-wider mb-2">Descrição</h3>
            <p className="text-jp-gray-light leading-relaxed">
              {description || 'Nenhuma descrição disponível para este exercício.'}
            </p>
          </div>

          {/* Muscles */}
          {muscles.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-jp-orange uppercase tracking-wider mb-2">Músculos Principais</h3>
              <div className="flex flex-wrap gap-2">
                {muscles.map(m => (
                  <span key={m} className="badge bg-jp-orange/20 text-jp-orange border border-jp-orange/30">{m}</span>
                ))}
              </div>
            </div>
          )}

          {musclesSecondary.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-jp-gray uppercase tracking-wider mb-2">Músculos Secundários</h3>
              <div className="flex flex-wrap gap-2">
                {musclesSecondary.map(m => (
                  <span key={m} className="badge-dark">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          {equipment.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-jp-gray uppercase tracking-wider mb-2">Equipamento</h3>
              <div className="flex flex-wrap gap-2">
                {equipment.map(e => (
                  <span key={e} className="badge bg-jp-border text-jp-gray-light">{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested sets */}
          <div className="bg-jp-card-light rounded-xl p-4 border border-jp-border">
            <h3 className="text-sm font-semibold text-jp-orange uppercase tracking-wider mb-3 flex items-center gap-2">
              <Target size={14} />
              Sugestão de Séries
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Iniciante', sets: '3', reps: '8-10' },
                { label: 'Intermediário', sets: '4', reps: '10-12' },
                { label: 'Avançado', sets: '5', reps: '12-15' },
              ].map(({ label, sets, reps }) => (
                <div key={label} className="bg-jp-border/50 rounded-lg p-3">
                  <p className="text-jp-orange text-xs font-semibold mb-1">{label}</p>
                  <p className="text-white text-sm font-bold">{sets} séries</p>
                  <p className="text-jp-gray text-xs">{reps} repetições</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExerciseCard({ exercise, onClick, translatedName }) {
  const translation = getPtTranslation(exercise)
  const name = translatedName || translation?.name || 'Exercício sem nome'
  const muscles = exercise.muscles?.map(m => translateTerm(m.name || m.name_en)).filter(Boolean).slice(0, 2) || []
  const equipment = translateTerm(exercise.equipment?.map(e => e.name)[0]) || 'Nenhum'
  const categoryId = exercise.category?.id
  const categoryName = getCategoryName(categoryId, exercise.category?.name)

  return (
    <div
      onClick={() => onClick(exercise)}
      className="card cursor-pointer group hover:border-jp-orange/40"
    >
      {/* Category badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`badge text-xs ${CATEGORY_COLORS[categoryId] || 'badge-dark'}`}>
          {categoryName}
        </span>
        <Info size={14} className="text-jp-gray group-hover:text-jp-orange transition-colors" />
      </div>

      {/* Exercise name */}
      <h3 className="text-white font-semibold text-base leading-tight mb-3 line-clamp-2 group-hover:text-jp-orange transition-colors">
        {name}
      </h3>

      {/* Muscles */}
      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {muscles.map(m => (
            <span key={m} className="text-xs bg-jp-border text-jp-gray-light px-2 py-0.5 rounded-full">{m}</span>
          ))}
        </div>
      )}

      {/* Equipment */}
      <div className="flex items-center gap-1.5 text-jp-gray text-xs">
        <Dumbbell size={12} className="text-jp-orange" />
        <span>{equipment}</span>
      </div>
    </div>
  )
}

export default function Exercises() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [searchResults, setSearchResults] = useState(null)
  const [translatedNames, setTranslatedNames] = useState({})

  const LIMIT = 20

  const fetchExercises = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getExercises({ category: selectedCategory, offset: page * LIMIT, limit: LIMIT })
      setExercises(data.results || [])
      setTotal(data.count || 0)
    } catch (e) {
      setError('Falha ao carregar exercícios. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, page])

  useEffect(() => {
    if (!search) {
      setSearchResults(null)
      fetchExercises()
    }
  }, [fetchExercises, search])

  useEffect(() => {
    if (!search) return
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await searchExercises(search)
        // search returns suggestions, we need to map them
        const suggestions = data.suggestions || []
        setSearchResults(suggestions)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId)
    setPage(0)
    setSearch('')
    setSearchResults(null)
  }

  const totalPages = Math.ceil(total / LIMIT)
  const displayExercises = searchResults !== null
    ? exercises.filter(e => {
      const name = getPtTranslation(e)?.name || ''
      return searchResults.some(s => s.value?.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(s.value?.toLowerCase()))
    })
    : exercises

  useEffect(() => {
    let cancelled = false
    const pending = displayExercises.filter(ex => !translatedNames[ex.id]).slice(0, 8)
    if (!pending.length) return

    const translateNames = async () => {
      const entries = await Promise.all(
        pending.map(async (ex) => {
          const tr = getPtTranslation(ex)
          const force = tr?.language !== PT_LANGUAGE_ID
          const rawName = tr?.name || 'Exercício'
          const translatedName = await translateToPtBr(rawName, force)
          return [ex.id, translatedName]
        })
      )

      if (cancelled) return
      setTranslatedNames(prev => ({ ...prev, ...Object.fromEntries(entries) }))
    }

    translateNames()
    return () => { cancelled = true }
  }, [displayExercises, translatedNames])

  return (
    <div className="page-container pt-24">
      {selectedExercise && (
        <ExerciseModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">Biblioteca de Exercícios</h1>
        <p className="text-jp-gray">Explore mais de 500 exercícios com instruções detalhadas</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-jp-gray" />
        <input
          type="text"
          placeholder="Buscar exercício... ex: agachamento, supino"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-dark pl-11 pr-12"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setSearchResults(null) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-jp-gray hover:text-white"
          >
            <X size={16} />
          </button>
        )}
        {searchLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(({ id, name }) => (
          <button
            key={String(id)}
            onClick={() => handleCategoryChange(id)}
            className={selectedCategory === id ? 'tab-btn-active' : 'tab-btn-inactive'}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-jp-gray text-sm">
          {search
            ? `Resultados para "${search}"`
            : `${total.toLocaleString()} exercícios encontrados`
          }
        </p>
        {!search && total > LIMIT && (
          <p className="text-jp-gray text-sm">
            Página {page + 1} de {totalPages}
          </p>
        )}
      </div>

      {/* Exercise grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" text="Carregando exercícios..." />
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchExercises} className="btn-primary">Tentar novamente</button>
        </div>
      ) : displayExercises.length === 0 ? (
        <div className="text-center py-24">
          <Dumbbell size={48} className="text-jp-border mx-auto mb-4" />
          <p className="text-jp-gray text-lg">Nenhum exercício encontrado</p>
          <p className="text-jp-gray text-sm mt-2">Tente outra busca ou categoria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayExercises.map(exercise => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              translatedName={translatedNames[exercise.id]}
              onClick={setSelectedExercise}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!search && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10 flex-wrap">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            Anterior
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    pageNum === page
                      ? 'bg-jp-orange/15 text-jp-orange border border-jp-orange/50'
                      : 'bg-jp-card text-jp-gray hover:text-white hover:bg-jp-border'
                  }`}
                >
                  {pageNum + 1}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="btn-secondary py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Próxima
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
