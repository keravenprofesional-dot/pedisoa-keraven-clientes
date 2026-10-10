import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

// Instalada como aplicación no hay barra del navegador, así que no existe la
// flecha de volver atrás. Esta la reemplaza. No aparece en la pantalla de
// inicio de cada lado, porque de ahí no hay a dónde volver.
const INICIOS = ['/', '/admin', '/login', '/personal']

export default function BotonVolver({ className = '' }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (INICIOS.includes(pathname)) return null
  return (
    <button
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      className={`flex items-center gap-1 text-sm font-medium ${className}`}
      aria-label="Volver atrás"
    >
      <ArrowLeft size={20} /> Atrás
    </button>
  )
}
