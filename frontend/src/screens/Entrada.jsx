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

  const campo = 'mt-1.5 w-full rounded-xl border border-negro/12 bg-white px-4 py-3 font-sans text-[15px] focus:outline-none focus:ring-1 focus:ring-oro'
  const etiqueta = 'font-sans text-[10px] font-medium uppercase tracking-[0.24em] text-oroprof'
  const tab = (valor, Icono, texto) => (
    <button
      type="button"
      onClick={() => cambiar(valor)}
      className={`flex flex-1 items-center justify-center gap-2 py-3.5 font-sans text-[11px] font-medium uppercase tracking-[0.16em] transition ${
        pestana === valor ? 'bg-negro text-orosuave' : 'bg-cremaoscura/60 text-negro/45'
      }`}
    >
      <Icono size={14} strokeWidth={1.6} /> {texto}
    </button>
  )

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center p-6 ${esPersonal ? 'bg-negro' : 'fondo-keraven'}`}>
      <div className="mb-7 rounded-2xl bg-negro px-6 py-4 ring-1 ring-oro/35"><Logo size="lg" /></div>
      <p className={`mb-7 font-sans text-[10px] uppercase tracking-[0.5em] ${esPersonal ? 'text-oro/70' : 'text-oroprof'}`}>
        Keraven&nbsp;Profesional
      </p>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-oro/25">
        <div className="flex">
          {tab('clienta', User, 'Cliente o clienta')}
          {tab('personal', ShieldCheck, 'Administrador')}
        </div>
        <div className="filo-oro" />

        <form onSubmit={entrar} className="flex flex-col gap-4 p-6">
          {esPersonal ? (
            <>
              <div>
                <label className={etiqueta}>Usuario</label>
                <input required autoCapitalize="none" autoCorrect="off" spellCheck="false" autoComplete="username"
                  placeholder="Ej. manuel" value={uno} onChange={(e) => setUno(e.target.value)} className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Teléfono</label>
                <input type="password" inputMode="tel" required autoComplete="current-password"
                  placeholder="Tu número de teléfono" value={dos} onChange={(e) => setDos(e.target.value)} className={campo} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={etiqueta}>Tu teléfono o tu número de cliente</label>
                <input type="text" inputMode="tel" required autoComplete="tel"
                  placeholder="809-555-0000  ó  CL-000002" value={uno} onChange={(e) => setUno(e.target.value)} className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Código de acceso</label>
                <input type="text" required autoCapitalize="characters" autoComplete="one-time-code"
                  placeholder="Ej. 4KX9-PQ2M" value={dos} onChange={(e) => setDos(e.target.value.toUpperCase())}
                  className={`${campo} text-center text-lg tracking-[0.1em] font-semibold`} />
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            disabled={enviando || !uno || !dos}
            className="rounded-full bg-negro py-3.5 font-sans text-[12px] font-medium uppercase tracking-[0.24em] text-orosuave transition active:scale-[0.98] disabled:bg-negro/20 disabled:text-white"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>

      {!esPersonal && (
        <p className="mt-6 max-w-xs text-center font-sans text-[12px] leading-relaxed text-negro/40">
          Keraven Profesional te entrega tu código de acceso al registrarte.
          Si no lo tienes o lo perdiste, comunícate con nosotros.
        </p>
      )}
    </div>
  )
}
