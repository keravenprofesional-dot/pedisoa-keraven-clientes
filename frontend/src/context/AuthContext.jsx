import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { normalizeCode, soloDigitos } from '../utils/accessCode'

const AuthContext = createContext(null)

// Quién está conectado y qué puede hacer.
//   profile.tipo = 'personal' | 'clienta'
//   permisos     = Set con las claves de pedidos_permisos (el supremo las tiene todas)
// Las reglas de la base de datos son las que de verdad protegen; esto solo
// decide qué pantallas y botones mostrar.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [client, setClient] = useState(null)
  const [permisos, setPermisos] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null); setClient(null); setPermisos(new Set()); setLoading(false)
      return
    }
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (!prof || !prof.active) {
      // Cuenta sin perfil o desactivada: no debe quedarse dentro.
      await supabase.auth.signOut()
      setProfile(null); setClient(null); setPermisos(new Set()); setLoading(false)
      return
    }
    setProfile(prof)
    if (prof.tipo === 'clienta') {
      const { data: cli } = await supabase.from('clients').select('*').eq('profile_id', userId).maybeSingle()
      setClient(cli || null)
      setPermisos(new Set())
    } else {
      setClient(null)
      const { data: p } = await supabase.rpc('mis_permisos')
      setPermisos(new Set((p || []).map((x) => (typeof x === 'string' ? x : x.mis_permisos))))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Quién está conectado AHORA. Sirve para no recargar de gusto.
    let quienEs = undefined

    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user?.id ?? null
      quienEs = id
      setSession(data.session)
      cargar(id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, sess) => {
      const id = sess?.user?.id ?? null
      setSession(sess)
      // Supabase avisa también cuando renueva la sesión sola o cuando vuelves
      // a la pestaña. Si sigue siendo la misma persona no hay que recargar
      // nada: recargar apagaba la pantalla y te borraba lo que estabas
      // escribiendo.
      if (id === quienEs) return
      quienEs = id
      // Se difiere para no llamar a Supabase dentro de su propio aviso.
      setTimeout(() => cargar(id), 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [cargar])

  // Traduce lo que escribe la persona al correo interno de su cuenta.
  async function correoDe(identificador, esClienta) {
    const { data, error } = await supabase.rpc('correo_de_entrada', { identificador, es_clienta: esClienta })
    if (error || !data) throw new Error('no-encontrado')
    return data
  }

  // Puerta de clientas: teléfono + cédula (o código de acceso si no tiene cédula).
  // normalizeCode deja solo letras y números, así que la cédula con guiones sirve igual.
  async function signInClienta(telefono, codigo) {
    const email = await correoDe(soloDigitos(telefono), true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: normalizeCode(codigo) })
    if (error) throw error
  }

  // Puerta del personal: usuario + teléfono.
  async function signInPersonal(usuario, telefono) {
    const email = await correoDe(usuario.trim().toLowerCase(), false)
    const { error } = await supabase.auth.signInWithPassword({ email, password: soloDigitos(telefono) })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const esPersonal = profile?.tipo === 'personal'
  const value = {
    session, profile, client, permisos, loading,
    esPersonal,
    esSupremo: esPersonal && profile?.es_supremo === true,
    puede: (p) => permisos.has(p),
    signInClienta, signInPersonal, signOut,
    reload: () => cargar(session?.user?.id),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
