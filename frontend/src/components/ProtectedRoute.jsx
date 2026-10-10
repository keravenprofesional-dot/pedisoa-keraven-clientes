import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MENU_ADMIN, puedeVer } from '../utils/menuAdmin'

// tipo: 'clienta' | 'personal' — cada uno tiene su propia puerta de entrada.
// item: (solo personal) entrada de MENU_ADMIN que exige permiso para esta pantalla.
export default function ProtectedRoute({ children, tipo, item }) {
  const auth = useAuth()
  const { session, profile, loading } = auth

  if (loading) return <div className="p-8 text-center text-gray-400">Cargando…</div>
  if (!session || !profile) return <Navigate to={tipo === 'personal' ? '/personal' : '/login'} replace />

  // Cada quien en su lado: una clienta nunca ve el panel y el personal no
  // usa la tienda de clientas.
  if (profile.tipo !== tipo) return <Navigate to={profile.tipo === 'personal' ? '/admin' : '/'} replace />

  if (item && !puedeVer(item, auth)) return <Navigate to="/admin" replace />
  return children
}

// Primera pantalla que esta persona del personal puede ver.
export function InicioPersonal() {
  const auth = useAuth()
  const primera = MENU_ADMIN.find((i) => puedeVer(i, auth))
  if (!primera) {
    return (
      <div className="p-8 text-center text-gray-500">
        Tu usuario todavía no tiene permisos asignados. Pídele al supremo usuario que te asigne un rol.
      </div>
    )
  }
  return <Navigate to={primera.to} replace />
}
