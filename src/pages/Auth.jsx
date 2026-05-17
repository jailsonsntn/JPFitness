import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Mail, Lock, User, ArrowRight, Dumbbell } from 'lucide-react'
import { signIn, signUp } from '../services/dbService'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Auth() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', fullName: '' })

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn({ email: form.email, password: form.password })
      } else {
        if (!form.fullName.trim()) { setError('Informe seu nome.'); setLoading(false); return }
        if (form.password.length < 6) { setError('Senha deve ter mínimo 6 caracteres.'); setLoading(false); return }
        await signUp({ email: form.email, password: form.password, fullName: form.fullName })
      }
      navigate('/dashboard')
    } catch (err) {
      const msg = err?.message || 'Erro desconhecido'
      if (msg.includes('Invalid login')) setError('E-mail ou senha incorretos.')
      else if (msg.includes('already registered')) setError('E-mail já cadastrado. Faça login.')
      else if (msg.includes('Email not confirmed')) setError('Confirme seu e-mail antes de entrar.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-jp-black flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-jp-orange-dark/40 via-jp-black to-jp-black" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #FF6200 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}
        />
        <div className="relative text-center max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-orange rounded-2xl flex items-center justify-center shadow-orange-lg">
              <Zap size={28} className="text-white" />
            </div>
            <span className="text-4xl font-black">JP<span className="gradient-text">Fitness</span></span>
          </div>
          <h2 className="text-3xl font-black text-white mb-4 leading-tight">
            Sua jornada fitness começa aqui
          </h2>
          <p className="text-jp-gray text-lg leading-relaxed mb-10">
            Treinos com IA, acompanhamento nutricional e mais de 500 exercícios. Tudo em um só lugar.
          </p>
          <div className="grid grid-cols-1 gap-4 text-left">
            {[
              { icon: '🤖', title: 'AI Trainer 24/7', sub: 'Tire dúvidas e receba planos personalizados com IA' },
              { icon: '🍎', title: 'Nutrição Inteligente', sub: 'Analise refeições e gere dietas com IA' },
              { icon: '📊', title: 'Progresso Real', sub: 'Acompanhe evolução com gráficos e métricas detalhadas' },
            ].map(({ icon, title, sub }) => (
              <div key={title} className="flex gap-4 p-4 bg-jp-card/60 rounded-xl border border-jp-border/50">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-white font-semibold">{title}</p>
                  <p className="text-jp-gray text-sm">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-gradient-orange rounded-xl flex items-center justify-center shadow-orange">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-2xl font-black">JP<span className="gradient-text">Fitness</span></span>
          </div>

          <h1 className="text-3xl font-black text-white mb-2">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta grátis'}
          </h1>
          <p className="text-jp-gray mb-8">
            {mode === 'login'
              ? 'Entre na sua conta para continuar treinando'
              : 'Comece sua transformação agora mesmo'}
          </p>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-jp-card border border-jp-border rounded-xl p-1 mb-6">
            {[
              { key: 'login', label: 'Entrar' },
              { key: 'register', label: 'Cadastrar' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setError('') }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === key
                    ? 'bg-jp-orange text-white shadow-orange'
                    : 'text-jp-gray hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (register only) */}
            {mode === 'register' && (
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-jp-gray" />
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={form.fullName}
                  onChange={set('fullName')}
                  className="input-dark pl-11"
                  required
                  autoComplete="name"
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-jp-gray" />
              <input
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={set('email')}
                className="input-dark pl-11"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-jp-gray" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                value={form.password}
                onChange={set('password')}
                className="input-dark pl-11 pr-11"
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-jp-gray hover:text-white transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center text-base py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar minha conta'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Register note */}
          {mode === 'register' && (
            <p className="text-jp-gray text-xs text-center mt-4">
              Ao criar uma conta você concorda com nossos termos de uso.
              Seus dados são armazenados com segurança no Supabase.
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-jp-border" />
            <span className="text-jp-gray text-xs">ou</span>
            <div className="flex-1 h-px bg-jp-border" />
          </div>

          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            className="w-full text-center text-sm text-jp-gray hover:text-white transition-colors"
          >
            {mode === 'login'
              ? <span>Não tem conta? <span className="text-jp-orange font-semibold">Cadastre-se grátis</span></span>
              : <span>Já tem conta? <span className="text-jp-orange font-semibold">Entrar</span></span>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
