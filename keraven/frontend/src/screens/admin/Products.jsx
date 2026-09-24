import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatMoney } from '../../utils/format'

const empty = { nombre: '', descripcion: '', precio: '', stock: 0, disponible: true, foto_url: '', categoria_id: '' }

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*').order('nombre'),
      supabase.from('categories').select('*').order('nombre'),
    ])
    setProducts(prods || [])
    setCategories(cats || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = { ...form, precio: Number(form.precio), stock: Number(form.stock) }
    if (editingId) {
      await supabase.from('products').update(payload).eq('id', editingId)
    } else {
      await supabase.from('products').insert(payload)
    }
    setForm(empty)
    setEditingId(null)
    load()
  }

  function startEdit(p) {
    setForm({ ...p, precio: String(p.precio) })
    setEditingId(p.id)
  }

  async function remove(id) {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-grafondo mb-4">Productos</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input required placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input required type="number" placeholder="Precio" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <input type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2">
          <option value="">Categoría</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input placeholder="URL de foto" value={form.foto_url} onChange={(e) => setForm({ ...form, foto_url: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.disponible} onChange={(e) => setForm({ ...form, disponible: e.target.checked })} />
          Disponible
        </label>
        <button className="bg-petroleo text-white rounded-lg py-2 font-semibold md:col-span-3">
          {editingId ? 'Guardar cambios' : 'Agregar producto'}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {products.map((p) => (
          <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{p.nombre}</p>
              <p className="text-sm text-petroleo font-bold">{formatMoney(p.precio)} · Stock: {p.stock}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(p)} className="text-sm text-petroleo font-semibold">Editar</button>
              <button onClick={() => remove(p.id)} className="text-sm text-red-500 font-semibold">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
