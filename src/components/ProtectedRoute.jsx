import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-jp-black flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-jp-gray text-sm mt-4">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/auth" replace />

  return children
}
