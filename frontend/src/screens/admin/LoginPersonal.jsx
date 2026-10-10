import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import Logo from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'

// Puerta del PERSONAL (supremo y usuarios con rol): usuario + teléfono.
// Dirección aparte (/personal); la pantalla de clientas no la enlaza.
export default function LoginPersonal() {
  const { signInPersonal, signOut, session, profile, loading: cargando } = useAuth()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cargando || !session || !profile) return
    if (profile.tipo === 'personal') navigate('/admin', { replace: true })
    else {
      // Una clienta no entra por esta puerta.
      signOut()
      setError('Esta entrada es solo para el personal de Keraven.')
    }
  }, [cargando, session, profile, navigate, signOut])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInPersonal(usuario, telefono)
    } catch {
      setError('Usuario o teléfono incorrecto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-petroleo p-6">
      <div className="mb-8 bg-white rounded-2xl px-6 py-4"><Logo size="lg" /></div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-2 justify-center mb-5 text-petroleo">
          <ShieldCheck size={20} />
          <h1 className="font-bold">Entrada del personal</h1>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-grafondo">Usuario</label>
            <input
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="username"
              placeholder="Ej. manuel"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-petroleo"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-grafondo">Teléfono</label>
            <input
              type="password"
              inputMode="tel"
              required
              autoComplete="current-password"
              placeholder="Tu número de teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-petroleo"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            disabled={loading || !usuario || !telefono}
            className="bg-dorado text-petroleo rounded-xl py-3 font-bold active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
