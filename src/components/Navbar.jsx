import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Dumbbell, LayoutDashboard, BookOpen, Bot, Menu, X,
  User, LogOut, Settings, ChevronDown, Download
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { signOut } from '../services/dbService'

const navLinks = [
  { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { to: '/exercises', label: 'Exercícios', icon: BookOpen },
  { to: '/workouts', label: 'Treinos', icon: Dumbbell },
  { to: '/ai-trainer', label: 'Treinador IA', icon: Bot },
]

function UserMenu({ user, profile, onSignOut }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = (profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-jp-card border border-jp-border hover:border-jp-orange/40 rounded-xl px-3 py-1.5 transition-all duration-200"
      >
        <div className="w-7 h-7 bg-gradient-orange rounded-lg flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
        <span className="hidden sm:block text-sm text-white font-medium max-w-[100px] truncate">
          {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuário'}
        </span>
        <ChevronDown size={14} className={`text-jp-gray transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-jp-card border border-jp-border rounded-xl shadow-card-hover overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-jp-border">
            <p className="text-white font-semibold text-sm truncate">{profile?.full_name || 'Usuário'}</p>
            <p className="text-jp-gray text-xs truncate">{user?.email}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); navigate('/profile') }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-jp-gray hover:text-white hover:bg-jp-card-light text-sm transition-colors"
            >
              <Settings size={14} />
              Configurar perfil
            </button>
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-jp-card-light text-sm transition-colors"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, isAuthenticated } = useAuth()
  const isHome = location.pathname === '/'

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [location])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleSignOut = async () => {
    await signOut().catch(() => {})
    navigate('/')
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    try {
      await installPrompt.userChoice
    } finally {
      setInstallPrompt(null)
    }
  }

  const navBg = scrolled || !isHome
    ? 'bg-jp-dark/95 backdrop-blur-md border-b border-jp-border shadow-card'
    : 'bg-transparent'

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 group">
            <img
              src="/logo/logo1.svg"
              alt="JPFitness"
              className="w-9 h-9 object-contain drop-shadow-[0_0_10px_rgba(255,98,0,0.35)]"
            />
            <img
              src="/logo/logo2.svg"
              alt="JPFitness"
              className="h-6 w-auto hidden sm:block"
            />
          </NavLink>

          {/* Desktop Nav (only when authenticated) */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-jp-orange text-white shadow-orange'
                        : 'text-jp-gray hover:text-white hover:bg-jp-card'
                    }`
                  }
                >
                  <Icon size={15} />
                  {label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated && installPrompt && (
              <button
                onClick={handleInstall}
                className="hidden sm:flex items-center gap-2 text-sm bg-jp-card border border-jp-border hover:border-jp-orange/50 rounded-xl px-3 py-2 text-jp-gray-light hover:text-white transition-colors"
              >
                <Download size={14} />
                Instalar app
              </button>
            )}
            {isAuthenticated ? (
              <UserMenu user={user} profile={profile} onSignOut={handleSignOut} />
            ) : (
              <NavLink to="/auth" className="btn-primary text-sm py-2 px-5">
                Entrar
              </NavLink>
            )}
            {isAuthenticated && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 rounded-xl bg-jp-card border border-jp-border text-jp-gray hover:text-white transition-colors"
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && isAuthenticated && (
        <div className="md:hidden border-t border-jp-border bg-jp-dark/98 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            {installPrompt && (
              <button
                onClick={handleInstall}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-jp-gray hover:text-white hover:bg-jp-card"
              >
                <Download size={18} />
                Instalar app
              </button>
            )}
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-jp-orange text-white'
                      : 'text-jp-gray hover:text-white hover:bg-jp-card'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
            <NavLink to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-jp-gray hover:text-white hover:bg-jp-card">
              <Settings size={18} />
              Configurar perfil
            </NavLink>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-jp-card"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
