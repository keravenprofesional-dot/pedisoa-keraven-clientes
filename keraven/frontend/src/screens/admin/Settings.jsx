import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [banks, setBanks] = useState([])
  const [newBank, setNewBank] = useState({ banco: '', tipo_cuenta: '', numero: '', titular: '', moneda: 'RD$' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: s } = await supabase.from('company_settings').select('*').single()
    setSettings(s)
    const { data: b } = await supabase.from('bank_accounts').select('*')
    setBanks(b || [])
  }

  async function saveSettings(e) {
    e.preventDefault()
    await supabase.from('company_settings').update(settings).eq('id', 1)
    load()
  }

  async function addBank(e) {
    e.preventDefault()
    await supabase.from('bank_accounts').insert(newBank)
    setNewBank({ banco: '', tipo_cuenta: '', numero: '', titular: '', moneda: 'RD$' })
    load()
  }

  async function toggleBank(id, activo) {
    await supabase.from('bank_accounts').update({ activo: !activo }).eq('id', id)
    load()
  }

  if (!settings) return <p className="p-8 text-gray-400">Cargando…</p>

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-grafondo mb-4">Configuración de Keraven Profesional</h1>

      <form onSubmit={saveSettings} className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 flex flex-col gap-3">
        {['nombre', 'telefono', 'whatsapp', 'correo', 'direccion'].map((field) => (
          <input
            key={field}
            placeholder={field}
            value={settings[field] || ''}
            onChange={(e) => setSettings({ ...settings, [field]: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2"
          />
        ))}
        <button className="bg-petroleo text-white rounded-lg py-2 font-semibold">Guardar</button>
      </form>

      <h2 className="font-bold text-grafondo mb-3">Cuentas bancarias</h2>
      <form onSubmit={addBank} className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 grid grid-cols-2 gap-3">
        <input required placeholder="Banco" value={newBank.banco} onChange={(e) => setNewBank({ ...newBank, banco: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input placeholder="Tipo de cuenta" value={newBank.tipo_cuenta} onChange={(e) => setNewBank({ ...newBank, tipo_cuenta: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input required placeholder="Número" value={newBank.numero} onChange={(e) => setNewBank({ ...newBank, numero: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input required placeholder="Titular" value={newBank.titular} onChange={(e) => setNewBank({ ...newBank, titular: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <button className="col-span-2 bg-petroleo text-white rounded-lg py-2 font-semibold">Agregar cuenta</button>
      </form>

      <div className="flex flex-col gap-2">
        {banks.map((b) => (
          <div key={b.id} className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center text-sm">
            <span>{b.banco} — {b.numero} — {b.titular}</span>
            <button onClick={() => toggleBank(b.id, b.activo)} className={b.activo ? 'text-green-600 font-semibold' : 'text-gray-400'}>
              {b.activo ? 'Activa' : 'Inactiva'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
