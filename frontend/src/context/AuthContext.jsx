import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { normalizePhone, isEmail } from '../utils/accessCode'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      setClient(null)
      return
    }
    loadProfileAndClient(session.user.id)
  }, [session])

  async function loadProfileAndClient(userId) {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(prof || null)
    if (prof && prof.role === 'clienta') {
      const { data: cli } = await supabase.from('clients').select('*').eq('profile_id', userId).single()
      setClient(cli || null)
    }
  }

  // Acceso de la clienta: su teléfono O su correo, más el código de
  // acceso que le dio el administrador (funciona como su contraseña).
  async function signIn(identifier, code) {
    const trimmedId = identifier.trim()
    const payload = isEmail(trimmedId)
      ? { email: trimmedId, password: code.trim() }
      : { phone: normalizePhone(trimmedId), password: code.trim() }
    const { data, error } = await supabase.auth.signInWithPassword(payload)
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = { session, profile, client, loading, signIn, signOut, reload: () => loadProfileAndClient(session?.user?.id) }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
