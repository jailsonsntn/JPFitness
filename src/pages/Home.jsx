import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  Zap, Bot, BookOpen, ArrowRight, Play, Star,
  Users, Dumbbell, TrendingUp, ChevronRight, Shield, Clock
} from 'lucide-react'

const stats = [
  { value: 500, suffix: '+', label: 'Exercícios' },
  { value: 50, suffix: 'k+', label: 'Treinos Feitos' },
  { value: 98, suffix: '%', label: 'Satisfação' },
  { value: 24, suffix: '/7', label: 'IA Disponível' },
]

const features = [
  {
    icon: Bot,
    title: 'Treinador IA Pessoal',
    description: 'Converse com nossa IA treinada em fitness para receber planos personalizados, tirar dúvidas e obter motivação quando precisar.',
    color: 'text-jp-orange',
    bg: 'bg-jp-orange/10',
    link: '/ai-trainer',
    badge: 'Tecnologia de IA'
  },
  {
    icon: BookOpen,
    title: 'Biblioteca de Exercícios',
    description: 'Mais de 500 exercícios com instruções detalhadas, músculos trabalhados e variações. Nunca fique sem saber o que treinar.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    link: '/exercises',
    badge: '500+ exercícios'
  },
  {
    icon: TrendingUp,
    title: 'Evolução de Carga',
    description: 'Acompanhe seu progresso por sessão, volume total e recordes de carga em cada exercício.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    link: '/dashboard',
    badge: 'Monitoramento real'
  },
]

const steps = [
  {
    number: '01',
    title: 'Defina seu Objetivo',
    description: 'Emagrecer, ganhar massa, melhorar resistência — diga à nossa IA o que você quer alcançar.'
  },
  {
    number: '02',
    title: 'Receba seu Plano',
    description: 'Nossa IA cria um plano de treino personalizado para você em segundos.'
  },
  {
    number: '03',
    title: 'Acompanhe Progresso',
    description: 'Registre treinos e monitore sua evolução com gráficos detalhados.'
  },
]

const testimonials = [
  { name: 'Rafael M.', role: 'Ganhou 8kg de massa', text: 'O Treinador IA me deu um plano que nenhum personal conseguiu antes. Resultados em 3 meses!', rating: 5 },
  { name: 'Ana P.', role: 'Perdeu 15kg', text: 'A organização dos treinos e a consistência diária mudaram meus resultados. Incrível!', rating: 5 },
  { name: 'Lucas S.', role: 'Corredor amador', text: 'A biblioteca de exercícios é absurdamente completa. Vale muito!', rating: 5 },
]

function Counter({ target, suffix }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 2000
        const step = target / (duration / 16)
        let current = 0
        const timer = setInterval(() => {
          current = Math.min(current + step, target)
          setCount(Math.floor(current))
          if (current >= target) clearInterval(timer)
        }, 16)
      }
    }, { threshold: 0.5 })

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return <span ref={ref}>{count}{suffix}</span>
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-jp-black">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-jp-orange/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-jp-orange/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-jp-orange/10 border border-jp-orange/30 text-jp-orange px-4 py-2 rounded-full text-sm font-semibold mb-8">
            <Zap size={14} />
            <span>IA Fitness #1 do Brasil</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-none mb-6">
            <span className="text-white">Transforme</span>
            <br />
            <span className="gradient-text text-shadow-orange">Seu Corpo</span>
            <br />
            <span className="text-white">com</span>{' '}
            <span className="gradient-text">Inteligência</span>
          </h1>

          <p className="text-jp-gray text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Treinos personalizados por IA, evolução de carga e acesso a mais de 500 exercícios.
            Tudo em um só lugar.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link to="/dashboard" className="btn-primary text-lg px-8 py-4 animate-pulse-orange">
              <Zap size={20} />
              Começar Grátis
            </Link>
            <Link to="/ai-trainer" className="btn-secondary text-lg px-8 py-4">
              <Bot size={20} />
              Falar com AI
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-jp-gray">
            {['100% Gratuito', 'Sem cadastro', 'IA em tempo real', 'Dados seguros'].map(t => (
              <div key={t} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-jp-orange" />
                <span>{t}</span>
              </div>
            ))}
          </div>

          {/* Floating cards preview */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-jp-black z-10" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto opacity-60">
              {[
                { title: 'Treino de Hoje', sub: 'Peito + Tríceps • 6 exercícios', icon: Dumbbell },
                { title: 'Carga Máxima', sub: 'Supino reto • 85kg na sessão', icon: TrendingUp },
                { title: 'Sequência', sub: '🔥 12 dias consecutivos!', icon: TrendingUp },
              ].map(({ title, sub, icon: Icon }) => (
                <div key={title} className="card text-left">
                  <Icon size={20} className="text-jp-orange mb-2" />
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-jp-gray text-xs mt-1">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-jp-dark border-y border-jp-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map(({ value, suffix, label }) => (
              <div key={label} className="text-center">
                <div className="text-4xl md:text-5xl font-black gradient-text mb-1">
                  <Counter target={value} suffix={suffix} />
                </div>
                <div className="text-jp-gray text-sm font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-jp-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="badge-orange mb-4 inline-block">Funcionalidades</span>
            <h2 className="section-title">Tudo que você precisa</h2>
            <p className="section-subtitle max-w-xl mx-auto">
              Uma plataforma completa com IA de ponta para te guiar em cada passo da sua jornada fitness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, description, color, bg, link, badge }) => (
              <Link key={title} to={link} className="card group cursor-pointer block">
                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon size={24} className={color} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-white">{title}</h3>
                </div>
                <span className="text-xs font-semibold text-jp-orange bg-jp-orange/10 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
                <p className="text-jp-gray text-sm leading-relaxed mt-3">{description}</p>
                <div className="flex items-center gap-2 mt-4 text-jp-orange text-sm font-semibold group-hover:gap-3 transition-all duration-200">
                  Explorar <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-jp-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="badge-orange mb-4 inline-block">Como funciona</span>
            <h2 className="section-title">3 passos para transformação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-jp-orange/50 via-jp-orange to-jp-orange/50" />

            {steps.map(({ number, title, description }, i) => (
              <div key={number} className="relative text-center">
                <div className="w-16 h-16 bg-gradient-orange rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-orange">
                  <span className="text-white font-black text-lg">{number}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                <p className="text-jp-gray text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-jp-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="badge-orange mb-4 inline-block">Depoimentos</span>
            <h2 className="section-title">Resultados reais</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map(({ name, role, text, rating }) => (
              <div key={name} className="card">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={14} className="text-jp-orange fill-jp-orange" />
                  ))}
                </div>
                <p className="text-jp-gray-light text-sm leading-relaxed mb-4">"{text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-orange rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{name}</p>
                    <p className="text-jp-orange text-xs">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-jp-orange-dark via-jp-orange to-jp-orange-dark opacity-90" />
        <div className="absolute inset-0 bg-jp-black/40" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <Zap size={48} className="text-white mx-auto mb-6 animate-glow" />
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Comece sua transformação hoje
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Junte-se a milhares de pessoas que já usam JPFitness para alcançar seus objetivos.
          </p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 bg-white text-jp-orange font-bold px-8 py-4 rounded-xl text-lg hover:bg-jp-black hover:text-white transition-all duration-200">
            Começar Agora <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-jp-dark border-t border-jp-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img
                src="/logo/logo1.svg"
                alt="JPFitness"
                className="w-8 h-8 object-contain"
              />
              <img
                src="/logo/logo2.svg"
                alt="JPFitness"
                className="h-5 w-auto"
              />
            </div>
            <p className="text-jp-gray text-sm">
              © 2026 JPFitness. Feito com 💪 e IA.
            </p>
            <div className="flex items-center gap-2 text-jp-gray text-xs">
              <Shield size={12} className="text-jp-orange" />
              <span>Seus dados são seguros</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
