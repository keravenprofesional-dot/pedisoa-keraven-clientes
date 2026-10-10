import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const CAMPOS = [
  ['nombre', 'Nombre de la empresa'],
  ['telefono', 'Teléfono'],
  ['whatsapp', 'WhatsApp (el que ven las clientas)'],
  ['correo', 'Correo'],
  ['direccion', 'Dirección'],
]
const TIPOS_CUENTA = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta de Nómina']

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [banks, setBanks] = useState([])
  const [newBank, setNewBank] = useState({ banco: '', tipo_cuenta: '', numero: '', titular: '', moneda: 'RD$' })
  const [aviso, setAviso] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: s }, { data: b }] = await Promise.all([
      supabase.from('company_settings').select('*').maybeSingle(),
      supabase.from('bank_accounts').select('*').order('banco'),
    ])
    setSettings(s || {})
    setBanks(b || [])
  }

  const reportar = (error, exito) => { setAviso(error ? 'No se pudo guardar: ' + error.message : exito); load() }

  async function saveSettings(e) {
    e.preventDefault()
    const { id, ...datos } = settings
    const { error } = await supabase.from('company_settings').update(datos).eq('id', 1)
    reportar(error, 'Datos de la empresa guardados.')
  }

  async function addBank(e) {
    e.preventDefault()
    const { error } = await supabase.from('bank_accounts').insert(newBank)
    if (!error) setNewBank({ banco: '', tipo_cuenta: '', numero: '', titular: '', moneda: 'RD$' })
    reportar(error, 'Cuenta agregada.')
  }
  const toggleBank = async (b) => reportar((await supabase.from('bank_accounts').update({ activo: !b.activo }).eq('id', b.id)).error, '')


  if (!settings) return <p className="p-8 text-gray-400">Cargando…</p>
  const input = 'border border-gray-200 rounded-lg px-3 py-2'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-grafondo mb-4">Configuración</h1>
      {aviso && <p className="bg-green-50 border border-green-200 text-green-900 text-sm rounded-xl p-3 mb-4">{aviso}</p>}

      <h2 className="font-bold text-grafondo mb-2">Datos de la empresa</h2>
      <form onSubmit={saveSettings} className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 flex flex-col gap-3">
        {CAMPOS.map(([campo, etiqueta]) => (
          <label key={campo} className="text-sm">{etiqueta}
            <input value={settings[campo] || ''} onChange={(e) => setSettings({ ...settings, [campo]: e.target.value })} className={`mt-1 w-full ${input}`} />
          </label>
        ))}
        <button className="bg-petroleo text-white rounded-lg py-2 font-semibold">Guardar</button>
      </form>

      <p className="bg-graclaro border border-gray-200 text-sm text-gray-600 rounded-xl p-3 mb-6">
        Las <strong>paradas de la ruta</strong> se administran en la pantalla de <strong>Clientas</strong>,
        que es donde se le asigna una a cada quien.
      </p>

      <h2 className="font-bold text-grafondo mb-1">Cuentas bancarias</h2>
      <p className="text-sm text-gray-500 mb-3">Las clientas las ven en su recibo para poder transferir.</p>
      <form onSubmit={addBank} className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input required placeholder="Banco" value={newBank.banco} onChange={(e) => setNewBank({ ...newBank, banco: e.target.value })} className={input} />
        <select required value={newBank.tipo_cuenta} onChange={(e) => setNewBank({ ...newBank, tipo_cuenta: e.target.value })} className={input}>
          <option value="">Tipo de cuenta…</option>
          {TIPOS_CUENTA.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input required placeholder="Número de cuenta" value={newBank.numero} onChange={(e) => setNewBank({ ...newBank, numero: e.target.value })} className={input} />
        <input required placeholder="A nombre de" value={newBank.titular} onChange={(e) => setNewBank({ ...newBank, titular: e.target.value })} className={input} />
        <button className="md:col-span-2 bg-petroleo text-white rounded-lg py-2 font-semibold">Agregar cuenta</button>
      </form>
      <div className="flex flex-col gap-2">
        {banks.map((b) => (
          <div key={b.id} className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center gap-3 text-sm">
            <div>
              <p className="font-semibold">{b.banco} · <span className="font-normal text-petroleo">{b.tipo_cuenta || 'tipo sin indicar'}</span></p>
              <p className="text-gray-500">{b.numero} — a nombre de {b.titular} — {b.moneda}</p>
            </div>
            <button onClick={() => toggleBank(b)} className={b.activo ? 'text-green-600 font-semibold' : 'text-gray-400'}>
              {b.activo ? 'Activa' : 'Inactiva'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
