import { useEffect, useState } from 'react'
import { Copy, Check, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'
import { formatCode } from '../../utils/accessCode'

const emptyForm = {
  full_name: '', phone: '', phone2: '', correo: '', cedula: '', direccion: '',
  sector: '', ciudad: '', provincia: '', payment_condition: 'contado',
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [newCode, setNewCode] = useState(null) // { full_name, access_code } tras crear
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('clients').select('*, client_phones(phone)').order('full_name')
    setClients(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-client', { body: form })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setNewCode({ full_name: form.full_name, access_code: data.access_code })
      setForm(emptyForm)
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.message || 'No se pudo crear la clienta. Intenta de nuevo.')
    } finally {
      setCreating(false)
    }
  }

  function copyCode(id, code) {
    navigator.clipboard?.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.client_number?.toLowerCase().includes(search.toLowerCase()) ||
    c.client_phones?.some((p) => p.phone.includes(search)) ||
    c.access_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-grafondo">Clientas</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-petroleo text-white text-sm font-semibold rounded-xl px-4 py-2"
        >
          <UserPlus size={16} /> Nueva clienta
        </button>
      </div>

      {newCode && (
        <div className="bg-dorado/10 border border-dorado rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-grafondo">
              Clienta <strong>{newCode.full_name}</strong> creada. Entrégale este código de acceso
              (ella entra con su teléfono o correo + este código):
            </p>
            <p className="text-2xl font-extrabold text-petroleo tracking-widest mt-1">
              {formatCode(newCode.access_code)}
            </p>
          </div>
          <button
            onClick={() => copyCode('new', newCode.access_code)}
            className="text-petroleo p-2"
            title="Copiar código"
          >
            {copiedId === 'new' ? <Check size={20} /> : <Copy size={20} />}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input required placeholder="Nombre completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input required placeholder="Teléfono (con código de país, ej. +1 809 555 0000)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input placeholder="Segundo teléfono (opcional)" value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input type="email" placeholder="Correo electrónico (opcional)" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input placeholder="Cédula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          <select value={form.payment_condition} onChange={(e) => setForm({ ...form, payment_condition: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2">
            <option value="contado">Contado</option>
            <option value="avance">Avance</option>
            <option value="credito">Crédito</option>
          </select>
          <input placeholder="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 md:col-span-2" />
          <input placeholder="Sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input placeholder="Ciudad o pueblo" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          <input placeholder="Provincia" value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
          {error && <p className="text-red-500 text-sm md:col-span-3">{error}</p>}
          <button disabled={creating} className="md:col-span-3 bg-petroleo text-white rounded-lg py-2 font-semibold disabled:opacity-60">
            {creating ? 'Creando…' : 'Crear clienta y generar código'}
          </button>
        </form>
      )}

      <input
        placeholder="Buscar por nombre, número de cliente, teléfono o código…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-96 border border-gray-200 rounded-xl px-4 py-2 mb-4"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{c.full_name}</p>
                <p className="text-xs text-petroleo font-bold">{c.client_number}</p>
                <p className="text-sm text-gray-500">{c.client_phones?.map((p) => p.phone).join(', ')}</p>
                {c.correo && <p className="text-sm text-gray-500">{c.correo}</p>}
                <p className="text-sm text-gray-500">{c.sector} — {c.ciudad}</p>
              </div>
              <button
                onClick={() => copyCode(c.id, c.access_code)}
                className="flex items-center gap-1 text-xs font-bold text-petroleo bg-graclaro rounded-lg px-2 py-1"
                title="Copiar código de acceso"
              >
                {copiedId === c.id ? <Check size={13} /> : <Copy size={13} />}
                {formatCode(c.access_code)}
              </button>
            </div>
            <p className="text-sm mt-2">
              Condición: <span className="capitalize font-medium">{c.payment_condition}</span>
              {c.balance_pendiente > 0 && (
                <span className="text-red-500 font-semibold"> · Balance: {formatMoney(c.balance_pendiente)}</span>
              )}
            </p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-400 text-center py-10 md:col-span-2">No hay clientas todavía.</p>
        )}
      </div>
    </div>
  )
}
