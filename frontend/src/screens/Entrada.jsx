import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, User } from 'lucide-react'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

// Una sola pantalla de entrada con dos pestañas: clienta o personal.
// Cada una pide datos distintos:
//   clienta  → su teléfono (o su número de clienta) + su código de acceso
//   personal → su usuario + su teléfono
// `inicio` dice en qué pestaña abrir: /login entra por clienta, /personal
// por el personal (así la app del personal instalada abre en la suya).
export default function Entrada({ inicio = 'clienta' }) {
  const { signInClienta, signInPersonal, signOut, session, profile, loading: cargando } = useAuth()
  const navigate = useNavigate()
  const [pestana, setPestana] = useState(inicio)
  const [uno, setUno] = useState('')   // teléfono / usuario
  const [dos, setDos] = useState('')   // código / teléfono
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esPersonal = pestana === 'personal'

  useEffect(() => {
    if (cargando || !session || !profile) return
    navigate(profile.tipo === 'personal' ? '/admin' : '/', { replace: true })
  }, [cargando, session, profile, navigate])

  function cambiar(a) {
    setPestana(a)
    setUno(''); setDos(''); setError('')
  }

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      if (esPersonal) await signInPersonal(uno, dos)
      else await signInClienta(uno, dos)
    } catch {
      setError(esPersonal
        ? 'Usuario o teléfono incorrecto.'
        : 'Teléfono o código incorrecto. Verifícalo con Keraven Profesional.')
      setEnviando(false)
    }
  }

  const campo = 'mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-petroleo'
  const tab = (valor, Icono, texto) => (
    <button
      type="button"
      onClick={() => cambiar(valor)}
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition ${
        pestana === valor ? 'bg-petroleo text-white' : 'bg-graclaro text-gray-500'
      }`}
    >
      <Icono size={16} /> {texto}
    </button>
  )

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${esPersonal ? 'bg-petroleo' : 'bg-graclaro'}`}>
      <div className={`mb-8 ${esPersonal ? 'bg-white rounded-2xl px-6 py-4' : ''}`}><Logo size="lg" /></div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex">
          {tab('clienta', User, 'Cliente o clienta')}
          {tab('personal', ShieldCheck, 'Administrador')}
        </div>

        <form onSubmit={entrar} className="flex flex-col gap-4 p-6">
          {esPersonal ? (
            <>
              <div>
                <label className="text-sm font-medium text-grafondo">Usuario</label>
                <input required autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="username"
                  placeholder="Ej. manuel" value={uno} onChange={(e) => setUno(e.target.value)} className={campo} />
              </div>
              <div>
                <label className="text-sm font-medium text-grafondo">Teléfono</label>
                <input type="password" inputMode="tel" required autoComplete="current-password"
                  placeholder="Tu número de teléfono" value={dos} onChange={(e) => setDos(e.target.value)} className={campo} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-grafondo">Tu teléfono o tu número de cliente</label>
                <input type="text" inputMode="tel" required autoComplete="tel"
                  placeholder="809-555-0000  ó  CL-000002" value={uno} onChange={(e) => setUno(e.target.value)} className={campo} />
              </div>
              <div>
                <label className="text-sm font-medium text-grafondo">Código de acceso</label>
                <input type="text" required autoCapitalize="characters" autoComplete="one-time-code"
                  placeholder="Ej. 4KX9-PQ2M" value={dos} onChange={(e) => setDos(e.target.value.toUpperCase())}
                  className={`${campo} text-center text-lg tracking-[0.1em] font-semibold`} />
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            disabled={enviando || !uno || !dos}
            className={`rounded-xl py-3 font-bold active:scale-[0.98] transition disabled:opacity-50 ${
              esPersonal ? 'bg-dorado text-petroleo' : 'bg-petroleo text-white'
            }`}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>

      {!esPersonal && (
        <p className="text-xs text-gray-400 mt-6 text-center max-w-xs">
          Keraven Profesional te entrega tu código de acceso al registrarte.
          Si no lo tienes o lo perdiste, comunícate con nosotros.
        </p>
      )}
    </div>
  )
}
