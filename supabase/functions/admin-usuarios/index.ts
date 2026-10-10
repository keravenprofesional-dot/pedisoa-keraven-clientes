// Supabase Edge Function: admin-usuarios
//
// ÚNICO lugar donde se crean o cambian cuentas (la app no puede escribir
// perfiles directamente: ver las reglas de `profiles` en la migración).
// Cada acción revisa los permisos de quien llama ANTES de hacer nada.
//
// Acciones (body JSON: { accion, ...datos }):
//   crear_personal    → solo supremo. { full_name, usuario, telefono, rol_id }
//   editar_personal   → solo supremo. { id, full_name?, usuario?, telefono?, rol_id?, active? }
//   crear_clienta     → permiso crear_clientas. Devuelve el código de acceso.
//   editar_clienta    → permiso editar_clientas.
//   regenerar_codigo  → permiso editar_clientas. Devuelve el código nuevo.
//
// Cómo entra cada quien (Supabase Auth con correos internos inventados):
//   personal: <usuario>@personal.keraven.local, contraseña = su teléfono (solo dígitos)
//   clienta:  cl-<aleatorio>@clientas.keraven.local, contraseña = su código
// La app traduce lo que escribe la persona a ese correo con correo_de_entrada().
//
// Supabase inyecta SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

class Fallo extends Error {
  constructor(msg: string, public status = 400) { super(msg) }
}

const DOM_PERSONAL = 'personal.keraven.local'
const DOM_CLIENTAS = 'clientas.keraven.local'
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin 0/O/1/I

function aleatorio(n: number, chars = CODE_CHARS) {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}
const soloDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const texto = (v: unknown, max = 200) => {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, max) : null
}

function validarUsuario(u: unknown) {
  const v = String(u ?? '').trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,30}$/.test(v)) throw new Fallo('El usuario debe tener 3 a 30 letras o números, sin espacios')
  return v
}
function validarTelefono(t: unknown, campo = 'El teléfono') {
  const d = soloDigitos(t)
  if (d.length < 7 || d.length > 15) throw new Fallo(`${campo} debe tener entre 7 y 15 números`)
  return d
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) throw new Fallo('No autenticado', 401)

    // Cliente "como quien llama": las funciones de permiso ven su auth.uid().
    const comoLlamante = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: quien, error: errQuien } = await comoLlamante.auth.getUser(authHeader.slice(7))
    if (errQuien || !quien?.user) throw new Fallo('No autenticado', 401)
    const yo = quien.user.id

    const permiso = async (p: string) => {
      const { data, error } = await comoLlamante.rpc('tiene_permiso', { p })
      if (error) throw new Fallo('No se pudo comprobar el permiso', 500)
      return data === true
    }
    const exigir = async (p: string) => { if (!(await permiso(p))) throw new Fallo('No tienes permiso para esto', 403) }
    const exigirSupremo = async () => {
      const { data } = await comoLlamante.rpc('es_supremo')
      if (data !== true) throw new Fallo('Solo el supremo usuario puede administrar al personal', 403)
    }

    const admin = createClient(url, service, { auth: { persistSession: false } })
    const body = await req.json().catch(() => ({}))

    switch (body.accion) {
      case 'crear_personal': await exigirSupremo(); return json(await crearPersonal(admin, body))
      case 'editar_personal': await exigirSupremo(); return json(await editarPersonal(admin, body, yo))
      case 'crear_clienta': await exigir('crear_clientas'); return json(await crearClienta(admin, body, yo, await permiso('editar_clientas')))
      case 'editar_clienta': await exigir('editar_clientas'); return json(await editarClienta(admin, body))
      case 'regenerar_codigo': await exigir('editar_clientas'); return json(await regenerarCodigo(admin, body))
      default: throw new Fallo('Acción no válida')
    }
  } catch (e) {
    if (e instanceof Fallo) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Error inesperado. Intenta de nuevo.' }, 500)
  }
})

// ---------- Personal --------------------------------------------------------

async function crearPersonal(admin: SupabaseClient, b: Record<string, unknown>) {
  const full_name = texto(b.full_name, 120)
  if (!full_name) throw new Fallo('El nombre es obligatorio')
  const usuario = validarUsuario(b.usuario)
  const telefono = validarTelefono(b.telefono)
  if (!b.rol_id) throw new Fallo('Elige un rol')
  const { data: rol } = await admin.from('pedidos_roles').select('id').eq('id', b.rol_id).maybeSingle()
  if (!rol) throw new Fallo('El rol no existe')
  const { data: existe } = await admin.from('profiles').select('id').eq('usuario', usuario).maybeSingle()
  if (existe) throw new Fallo('Ya existe alguien con ese usuario')

  const { data: nuevo, error } = await admin.auth.admin.createUser({
    email: `${usuario}@${DOM_PERSONAL}`, password: telefono, email_confirm: true,
  })
  if (error || !nuevo.user) throw new Fallo('No se pudo crear la cuenta: ' + (error?.message ?? ''))
  const { error: errPerfil } = await admin.from('profiles').insert({
    id: nuevo.user.id, tipo: 'personal', rol_id: rol.id, usuario, telefono, full_name,
  })
  if (errPerfil) {
    await admin.auth.admin.deleteUser(nuevo.user.id)
    throw new Fallo('No se pudo crear el perfil: ' + errPerfil.message)
  }
  return { ok: true, id: nuevo.user.id }
}

async function editarPersonal(admin: SupabaseClient, b: Record<string, unknown>, yo: string) {
  const { data: p } = await admin.from('profiles').select('*').eq('id', b.id).eq('tipo', 'personal').maybeSingle()
  if (!p) throw new Fallo('No existe ese usuario del personal', 404)

  const cambios: Record<string, unknown> = {}
  const cambiosAuth: Record<string, unknown> = {}
  if (b.full_name !== undefined) {
    const n = texto(b.full_name, 120); if (!n) throw new Fallo('El nombre es obligatorio')
    cambios.full_name = n
  }
  if (b.usuario !== undefined) {
    const u = validarUsuario(b.usuario)
    if (u !== p.usuario) {
      const { data: otro } = await admin.from('profiles').select('id').eq('usuario', u).maybeSingle()
      if (otro) throw new Fallo('Ya existe alguien con ese usuario')
      cambios.usuario = u
      cambiosAuth.email = `${u}@${DOM_PERSONAL}`
      cambiosAuth.email_confirm = true
    }
  }
  if (b.telefono !== undefined) {
    const t = validarTelefono(b.telefono)
    cambios.telefono = t
    cambiosAuth.password = t
  }
  if (b.rol_id !== undefined) {
    if (p.es_supremo) throw new Fallo('El supremo usuario no lleva rol: ya tiene todos los permisos')
    const { data: rol } = await admin.from('pedidos_roles').select('id').eq('id', b.rol_id).maybeSingle()
    if (!rol) throw new Fallo('El rol no existe')
    cambios.rol_id = rol.id
  }
  if (b.active !== undefined) {
    if (p.id === yo && b.active === false) throw new Fallo('No puedes desactivar tu propia cuenta')
    cambios.active = b.active === true
  }

  if (Object.keys(cambiosAuth).length) {
    const { error } = await admin.auth.admin.updateUserById(p.id, cambiosAuth)
    if (error) throw new Fallo('No se pudo actualizar la entrada: ' + error.message)
  }
  // Al desactivar no hace falta cerrar su sesión: las reglas de la base de
  // datos dejan de mostrarle cualquier dato en cuanto active = false.
  if (Object.keys(cambios).length) {
    const { error } = await admin.from('profiles').update(cambios).eq('id', p.id)
    if (error) throw new Fallo('No se pudo guardar: ' + error.message)
  }
  return { ok: true }
}

// ---------- Clientas --------------------------------------------------------

function datosClienta(b: Record<string, unknown>, conCredito: boolean) {
  const d: Record<string, unknown> = {
    correo: texto(b.correo, 120), cedula: texto(b.cedula, 20), direccion: texto(b.direccion, 300),
    sector: texto(b.sector, 80), ciudad: texto(b.ciudad, 80), provincia: texto(b.provincia, 80),
    // Parada de la ruta donde esta clienta recibe normalmente.
    delivery_stop_id: b.delivery_stop_id ? String(b.delivery_stop_id) : null,
  }
  if (conCredito) {
    const pc = String(b.payment_condition ?? 'contado')
    if (!['contado', 'avance', 'credito'].includes(pc)) throw new Fallo('Condición de pago no válida')
    d.payment_condition = pc
    d.credit_enabled = b.credit_enabled === true
    const lim = Number(b.credit_limit ?? 0)
    if (!Number.isFinite(lim) || lim < 0) throw new Fallo('El límite de crédito no es válido')
    d.credit_limit = lim
  }
  return d
}

async function crearClienta(admin: SupabaseClient, b: Record<string, unknown>, yo: string, puedeCredito: boolean) {
  const full_name = texto(b.full_name, 120)
  if (!full_name) throw new Fallo('El nombre es obligatorio')
  const telefono = validarTelefono(b.phone)
  const { data: existe } = await admin.from('clients').select('client_number').eq('telefono_login', telefono).maybeSingle()
  if (existe) throw new Fallo(`Ese teléfono ya es de la clienta ${existe.client_number}`)

  const codigo = aleatorio(8)
  const { data: nuevo, error } = await admin.auth.admin.createUser({
    email: `cl-${aleatorio(12, 'abcdefghijkmnpqrstuvwxyz23456789')}@${DOM_CLIENTAS}`,
    password: codigo, email_confirm: true,
  })
  if (error || !nuevo.user) throw new Fallo('No se pudo crear la cuenta: ' + (error?.message ?? ''))
  const uid = nuevo.user.id
  try {
    const { error: e1 } = await admin.from('profiles').insert({ id: uid, tipo: 'clienta', full_name })
    if (e1) throw new Fallo(e1.message)
    const { data: cli, error: e2 } = await admin.from('clients').insert({
      profile_id: uid, full_name, telefono_login: telefono, creado_por: yo, ...datosClienta(b, puedeCredito),
    }).select().single()
    if (e2) throw new Fallo(e2.message)
    const tels = [{ client_id: cli.id, phone: telefono, is_primary: true }]
    const t2 = soloDigitos(b.phone2)
    if (t2.length >= 7) tels.push({ client_id: cli.id, phone: t2, is_primary: false })
    await admin.from('client_phones').insert(tels)
    if (cli.direccion) {
      await admin.from('client_addresses').insert({ client_id: cli.id, address: cli.direccion, sector: cli.sector, is_default: true })
    }
    return { ok: true, access_code: codigo, client: cli }
  } catch (e) {
    await admin.auth.admin.deleteUser(uid) // no dejar cuentas a medias
    throw e instanceof Fallo ? e : new Fallo('No se pudo crear la clienta')
  }
}

async function editarClienta(admin: SupabaseClient, b: Record<string, unknown>) {
  const { data: c } = await admin.from('clients').select('*').eq('id', b.client_id).maybeSingle()
  if (!c) throw new Fallo('No existe esa clienta', 404)
  const cambios: Record<string, unknown> = datosClienta({ ...c, ...b }, true)
  if (b.full_name !== undefined) {
    const n = texto(b.full_name, 120); if (!n) throw new Fallo('El nombre es obligatorio')
    cambios.full_name = n
  }
  if (b.phone !== undefined) {
    const t = validarTelefono(b.phone)
    if (t !== c.telefono_login) {
      const { data: otra } = await admin.from('clients').select('client_number').eq('telefono_login', t).maybeSingle()
      if (otra) throw new Fallo(`Ese teléfono ya es de la clienta ${otra.client_number}`)
      cambios.telefono_login = t
      await admin.from('client_phones').update({ phone: t }).eq('client_id', c.id).eq('is_primary', true)
    }
  }
  const { error } = await admin.from('clients').update(cambios).eq('id', c.id)
  if (error) throw new Fallo('No se pudo guardar: ' + error.message)
  if (b.full_name !== undefined || b.active !== undefined) {
    const p: Record<string, unknown> = {}
    if (cambios.full_name) p.full_name = cambios.full_name
    if (b.active !== undefined) p.active = b.active === true
    await admin.from('profiles').update(p).eq('id', c.profile_id)
  }
  return { ok: true }
}

async function regenerarCodigo(admin: SupabaseClient, b: Record<string, unknown>) {
  const { data: c } = await admin.from('clients').select('id, profile_id').eq('id', b.client_id).maybeSingle()
  if (!c) throw new Fallo('No existe esa clienta', 404)
  const codigo = aleatorio(8)
  const { error } = await admin.auth.admin.updateUserById(c.profile_id, { password: codigo })
  if (error) throw new Fallo('No se pudo cambiar el código: ' + error.message)
  return { ok: true, access_code: codigo }
}
