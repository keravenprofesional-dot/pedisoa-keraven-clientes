// Supabase Edge Function: create-client
// Crea el usuario de autenticación, el perfil y el registro de clienta,
// generando su código de acceso. Solo puede ejecutarla un administrador
// autenticado (se valida el rol antes de hacer nada).
//
// Desplegar con:
//   supabase functions deploy create-client
//
// Requiere estos secrets (supabase secrets set NOMBRE=valor):
//   SB_URL              -> Project URL de Supabase
//   SB_SERVICE_ROLE_KEY -> Service role key (Project Settings → API)
//   CODE_EMAIL_DOMAIN   -> dominio ficticio para el login por código,
//                          ej: clientes.keraven.app

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sin 0/O/1/I
function generateCode(length = 8) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const SB_URL = Deno.env.get('SB_URL')
    const SB_SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY')
    const CODE_EMAIL_DOMAIN = Deno.env.get('CODE_EMAIL_DOMAIN') || 'clientes.keraven.app'

    const authHeader = req.headers.get('Authorization') || ''
    const callerToken = authHeader.replace('Bearer ', '')
    if (!callerToken) return jsonResponse({ error: 'No autenticado' }, 401)

    // Cliente "anon" para validar quién está llamando
    const supabaseAsCaller = createClient(SB_URL, Deno.env.get('SB_ANON_KEY') ?? SB_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await supabaseAsCaller.auth.getUser(callerToken)
    if (userErr || !userData?.user) return jsonResponse({ error: 'No autenticado' }, 401)

    // Cliente con permisos de administrador (service role) para crear registros
    const supabaseAdmin = createClient(SB_URL, SB_SERVICE_ROLE_KEY)

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'administrador') {
      return jsonResponse({ error: 'Solo un administrador puede crear clientas' }, 403)
    }

    const body = await req.json()
    const { full_name, phone, sector, ciudad, provincia, payment_condition } = body
    if (!full_name) return jsonResponse({ error: 'El nombre es obligatorio' }, 400)

    // Genera un código único (reintenta si por casualidad ya existe)
    let code = ''
    for (let attempt = 0; attempt < 15; attempt++) {
      const candidate = generateCode()
      const { data: existing } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('access_code', candidate)
        .maybeSingle()
      if (!existing) { code = candidate; break }
    }
    if (!code) return jsonResponse({ error: 'No se pudo generar un código único, intenta de nuevo' }, 500)

    const email = `${code.toLowerCase()}@${CODE_EMAIL_DOMAIN}`

    // 1. Crear el usuario de autenticación (su "contraseña" es el mismo código)
    const { data: newUser, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: code,
      email_confirm: true,
    })
    if (createUserErr) return jsonResponse({ error: createUserErr.message }, 400)

    // 2. Crear su perfil con rol "clienta"
    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: newUser.user.id,
      role: 'clienta',
      full_name,
    })
    if (profileErr) return jsonResponse({ error: profileErr.message }, 400)

    // 3. Crear el registro comercial de clienta, con el mismo código
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .insert({
        profile_id: newUser.user.id,
        full_name,
        access_code: code,
        sector, ciudad, provincia,
        payment_condition: payment_condition || 'contado',
      })
      .select()
      .single()
    if (clientErr) return jsonResponse({ error: clientErr.message }, 400)

    // 4. Guardar el teléfono de contacto (opcional, solo informativo, no se usa para login)
    if (phone) {
      await supabaseAdmin.from('client_phones').insert({
        client_id: client.id,
        phone,
        is_primary: true,
      })
    }

    return jsonResponse({ access_code: code, client })
  } catch (err) {
    return jsonResponse({ error: err.message || 'Error inesperado' }, 500)
  }
})
