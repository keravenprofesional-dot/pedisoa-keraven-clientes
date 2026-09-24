import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando…</div>
  if (!session) return <Navigate to="/login" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return children
}
