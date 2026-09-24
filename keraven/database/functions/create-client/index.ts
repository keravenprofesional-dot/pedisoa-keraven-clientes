// Supabase Edge Function: create-client
//
// La usa el panel de administrador para dar de alta una clienta.
// Genera un código de acceso único, crea su usuario de Auth con su
// teléfono (y correo, si lo da) como identificadores reales — sin
// necesitar enviar SMS ni correo de verificación — y sus registros en
// `profiles`, `clients`, `client_phones` y `client_addresses`.
// Devuelve el código para que el admin se lo entregue a la clienta.
//
// Login de la clienta: teléfono O correo + este código como contraseña.
//
// Usa la SERVICE ROLE KEY — por eso vive en un Edge Function y nunca
// en el frontend. Solo un usuario con rol "administrador" puede invocarla.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin 0/O/1/I
const CODE_LENGTH = 8

function generateCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return out
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // 1. Verificar que quien llama está autenticado y es administrador
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: caller, error: callerErr } = await admin.auth.getUser(jwt)
    if (callerErr || !caller?.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 })
    }
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.user.id)
      .single()
    if (callerProfile?.role !== 'administrador') {
      return new Response(JSON.stringify({ error: 'Solo un administrador puede crear clientas' }), { status: 403 })
    }

    // 2. Leer los datos de la nueva clienta
    const body = await req.json()
    const {
      full_name, phone, phone2, correo, cedula, direccion,
      sector, ciudad, provincia, payment_condition,
    } = body
    if (!full_name) {
      return new Response(JSON.stringify({ error: 'El nombre completo es requerido' }), { status: 400 })
    }
    if (!phone) {
      return new Response(JSON.stringify({ error: 'El teléfono es requerido (la clienta lo usa para entrar)' }), { status: 400 })
    }

    // 3. Generar un código único (reintenta si por casualidad ya existe)
    let code = ''
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateCode()
      const { data: existing } = await admin
        .from('clients')
        .select('id')
        .eq('access_code', candidate)
        .maybeSingle()
      if (!existing) { code = candidate; break }
    }
    if (!code) {
      return new Response(JSON.stringify({ error: 'No se pudo generar un código único, intenta de nuevo' }), { status: 500 })
    }

    // 4. Crear el usuario de Auth con teléfono (y correo, si lo dio) reales.
    //    password = el código de acceso. No se envía SMS ni correo: se
    //    crea ya confirmado, por eso esto solo puede hacerlo el backend
    //    (Service Role Key), nunca el frontend.
    const createPayload: Record<string, unknown> = {
      phone,
      password: code,
      phone_confirm: true,
      user_metadata: { full_name },
    }
    if (correo) {
      createPayload.email = correo
      createPayload.email_confirm = true
    }
    const { data: newUser, error: userErr } = await admin.auth.admin.createUser(createPayload)
    if (userErr || !newUser?.user) {
      return new Response(JSON.stringify({ error: userErr?.message || 'No se pudo crear el usuario' }), { status: 500 })
    }

    // 5. Crear el perfil y el registro comercial de clienta
    const { error: profileErr } = await admin.from('profiles').insert({
      id: newUser.user.id,
      role: 'clienta',
      full_name,
    })
    if (profileErr) {
      await admin.auth.admin.deleteUser(newUser.user.id) // revertir para no dejar usuarios huérfanos
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 500 })
    }

    const { data: client, error: clientErr } = await admin.from('clients').insert({
      profile_id: newUser.user.id,
      full_name,
      access_code: code,
      correo: correo || null,
      direccion: direccion || null,
      cedula_enc: cedula || null, // TODO: cifrar antes de guardar en producción
      sector, ciudad, provincia,
      payment_condition: payment_condition || 'contado',
    }).select().single()
    if (clientErr) {
      await admin.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: clientErr.message }), { status: 500 })
    }

    await admin.from('client_phones').insert({ client_id: client.id, phone, is_primary: true })
    if (phone2) {
      await admin.from('client_phones').insert({ client_id: client.id, phone: phone2, is_primary: false })
    }
    if (direccion) {
      await admin.from('client_addresses').insert({ client_id: client.id, address: direccion, sector, is_default: true })
    }

    return new Response(JSON.stringify({ access_code: code, client }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
