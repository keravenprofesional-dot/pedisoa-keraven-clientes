import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, User, UserPlus, CheckCircle2 } from 'lucide-react'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

// Una sola pantalla de entrada con TRES pestañas:
//   clienta  → su teléfono (o su número de cliente) + su código de acceso
//   nuevo    → una persona que todavía no es cliente pide su perfil
//   personal → su usuario + su teléfono (el personal)
// `inicio` dice en qué pestaña abrir: /login entra por clienta, /personal
// por el personal (así la app del personal instalada abre en la suya).
export default function Entrada({ inicio = 'clienta' }) {
  const { signInClienta, signInPersonal, session, profile, loading: cargando } = useAuth()
  const navigate = useNavigate()
  const [pestana, setPestana] = useState(inicio)
  const [uno, setUno] = useState('')   // teléfono / usuario
  const [dos, setDos] = useState('')   // código / teléfono
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Datos del formulario de "quiero ser cliente"
  const [sol, setSol] = useState({ nombre: '', telefono: '', telefono2: '', cedula: '', direccion: '', correo: '' })
  const [solOk, setSolOk] = useState(false)

  const esPersonal = pestana === 'personal'
  const esNuevo = pestana === 'nuevo'

  useEffect(() => {
    if (cargando || !session || !profile) return
    navigate(profile.tipo === 'personal' ? '/admin' : '/', { replace: true })
  }, [cargando, session, profile, navigate])

  function cambiar(a) {
    setPestana(a)
    setUno(''); setDos(''); setError(''); setSolOk(false)
  }

  async function entrar(e) {
    e.preventDefault()
    setError(''); setEnviando(true)
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

  async function solicitar(e) {
    e.preventDefault()
    setError(''); setEnviando(true)
    try {
      const { error: err } = await supabase.rpc('solicitar_cliente', {
        p_nombre: sol.nombre, p_telefono: sol.telefono, p_telefono2: sol.telefono2,
        p_cedula: sol.cedula, p_direccion: sol.direccion, p_correo: sol.correo,
      })
      if (err) throw err
      setSolOk(true)
    } catch (err) {
      const msg = err?.message || ''
      setError(msg && !/fetch|network|JWT/i.test(msg) ? msg : 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'mt-1.5 w-full rounded-xl border border-negro/12 bg-white px-4 py-3 font-sans text-[15px] focus:outline-none focus:ring-1 focus:ring-oro'
  const etiqueta = 'font-sans text-[10px] font-medium uppercase tracking-[0.24em] text-oroprof'
  const tab = (valor, Icono, texto) => (
    <button
      type="button"
      onClick={() => cambiar(valor)}
      className={`flex flex-1 items-center justify-center gap-1.5 px-1 py-3.5 font-sans text-[10px] font-medium uppercase tracking-[0.1em] transition ${
        pestana === valor ? 'bg-negro text-orosuave' : 'bg-cremaoscura/60 text-negro/45'
      }`}
    >
      <Icono size={13} strokeWidth={1.6} /> {texto}
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
          {tab('clienta', User, 'Cliente')}
          {tab('nuevo', UserPlus, 'Soy nuevo')}
          {tab('personal', ShieldCheck, 'Admin')}
        </div>
        <div className="filo-oro" />

        {esNuevo ? (
          solOk ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <CheckCircle2 size={44} strokeWidth={1.3} className="text-oro" />
              <h2 className="font-display text-[22px] text-negro">¡Solicitud enviada!</h2>
              <p className="font-sans text-[13px] leading-relaxed text-negro/55">
                Keraven Profesional revisará tus datos. Te escribiremos a <b className="text-negro/75">{sol.correo}</b> con
                la información de tu solicitud y tu acceso.
              </p>
              <button onClick={() => cambiar('clienta')} className="mt-2 font-sans text-[11px] uppercase tracking-[0.2em] text-oroprof">
                Volver a entrar
              </button>
            </div>
          ) : (
            <form onSubmit={solicitar} className="flex flex-col gap-3.5 p-6">
              <p className="font-sans text-[12.5px] leading-relaxed text-negro/55">
                ¿Quieres ser cliente de Keraven? Llena tus datos y te creamos tu perfil.
              </p>
              <div>
                <label className={etiqueta}>Nombre completo</label>
                <input required value={sol.nombre} onChange={(e) => setSol({ ...sol, nombre: e.target.value })}
                  placeholder="Tu nombre y apellidos" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Tu teléfono</label>
                <input required inputMode="tel" autoComplete="tel" value={sol.telefono}
                  onChange={(e) => setSol({ ...sol, telefono: e.target.value })} placeholder="809-555-0000" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Teléfono de referencia</label>
                <input inputMode="tel" value={sol.telefono2} onChange={(e) => setSol({ ...sol, telefono2: e.target.value })}
                  placeholder="Otro número (opcional)" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Cédula *</label>
                <input inputMode="numeric" required value={sol.cedula} onChange={(e) => setSol({ ...sol, cedula: e.target.value })}
                  placeholder="000-0000000-0" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Dirección</label>
                <input value={sol.direccion} onChange={(e) => setSol({ ...sol, direccion: e.target.value })}
                  placeholder="Calle, sector, ciudad" className={campo} />
              </div>
              <div>
                <label className={etiqueta}>Correo electrónico</label>
                <input required type="email" inputMode="email" autoComplete="email" value={sol.correo}
                  onChange={(e) => setSol({ ...sol, correo: e.target.value })} placeholder="tucorreo@ejemplo.com" className={campo} />
                <p className="mt-1.5 font-sans text-[11px] leading-snug text-negro/45">
                  Por este correo te enviaremos la información de tu solicitud y tu acceso.
                </p>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button
                disabled={enviando || !sol.nombre || !sol.telefono || !sol.correo}
                className="rounded-full bg-negro py-3.5 font-sans text-[12px] font-medium uppercase tracking-[0.24em] text-orosuave transition active:scale-[0.98] disabled:bg-negro/20 disabled:text-white"
              >
                {enviando ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </form>
          )
        ) : (
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
        )}
      </div>

      {pestana === 'clienta' && (
        <p className="mt-6 max-w-xs text-center font-sans text-[12px] leading-relaxed text-negro/40">
          Keraven Profesional te entrega tu código de acceso al registrarte.
          ¿Aún no eres cliente? Toca «Soy nuevo».
        </p>
      )}
    </div>
  )
}
