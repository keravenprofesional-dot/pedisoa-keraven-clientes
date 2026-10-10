import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(identifier, code)
      navigate('/')
    } catch (err) {
      setError('Teléfono/correo o código incorrecto. Verifica con Keraven Profesional.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-graclaro p-6">
      <div className="mb-10"><Logo size="lg" /></div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-grafondo">Teléfono o correo electrónico</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="809-555-0000 o tu@correo.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-petroleo"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-grafondo">Código de acceso</label>
            <input
              type="text"
              required
              autoCapitalize="characters"
              placeholder="Ej. 4KX9-PQ2M"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-lg tracking-[0.1em] font-semibold focus:outline-none focus:ring-2 focus:ring-petroleo"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            disabled={loading || !identifier || !code}
            className="bg-petroleo text-white rounded-xl py-3 font-semibold active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
      <p className="text-xs text-gray-400 mt-6 text-center max-w-xs">
        Keraven Profesional te entrega tu código de acceso al registrarte como clienta.
        Si no lo tienes, comunícate con nosotros.
      </p>
    </div>
  )
}
