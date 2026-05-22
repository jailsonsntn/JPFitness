import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import AppRuntime from './components/AppRuntime'
import Navbar from './components/Navbar'
import LoadingSpinner from './components/LoadingSpinner'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Exercises from './pages/Exercises'
import Workouts from './pages/Workouts'
import Cardio from './pages/Cardio'
import AITrainer from './pages/AITrainer'
import Profile from './pages/Profile'

function HomeRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-jp-black flex items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando..." />
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRuntime />
        <div className="min-h-screen bg-jp-black">
          <Navbar />
          <main className="min-h-screen bg-jp-black pt-20">
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
              <Route path="/workouts" element={<ProtectedRoute><Workouts /></ProtectedRoute>} />
              <Route path="/cardio" element={<ProtectedRoute><Cardio /></ProtectedRoute>} />
              <Route path="/ai-trainer" element={<ProtectedRoute><AITrainer /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
