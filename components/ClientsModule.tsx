'use client'
import { useState, useEffect, useCallback } from 'react'

const S = {
  card:    { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  input:   { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', width:'100%' },
  label:   { fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:4 },
  btn:     (bg='var(--accent)', color='#fff') => ({ padding:'8px 16px', borderRadius:8, border:'none', background:bg, color, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }),
  btnOut:  { padding:'6px 12px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' },
  th:      { textAlign:'left' as const, fontSize:10, color:'var(--text2)', fontWeight:600, padding:'6px 10px', borderBottom:'1px solid var(--border)', textTransform:'uppercase' as const },
  td:      { padding:'9px 10px', borderBottom:'1px solid var(--border)', fontSize:12, verticalAlign:'middle' as const },
}

interface ClientsModuleProps { token: string }

const emptyForm = { name:'', phone:'', dni:'', cp:'', notes:'' }

export default function ClientsModule({ token }: ClientsModuleProps) {
  const [clients, setClients]     = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [form, setForm]           = useState<any>(emptyForm)
  const [editing, setEditing]     = useState<any>(null)
  const [showForm, setShowForm]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState<{msg:string;ok:boolean}|null>(null)

  const showToast = (msg: string, ok = true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  const load = useCallback(async (q='') => {
    try {
      const res = await fetch(`/api/clients${q?`?q=${encodeURIComponent(q)}`:''}`, { headers:{ Authorization:`Bearer ${token}` } })
      const j = await res.json()
      setClients(j.data || [])
    } catch(e:any) { showToast(e.message, false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (c: any) => { setEditing(c); setForm({...c}); setShowForm(true) }

  const save = async () => {
    if (!form.name.trim()) return showToast('El nombre es obligatorio', false)
    setLoading(true)
    try {
      const method = editing ? 'PUT' : 'POST'
      const body = editing ? { id: editing.id, ...form } : form
      const res = await fetch('/api/clients', { method, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast(editing ? '✓ Cliente actualizado' : '✓ Cliente creado')
      setShowForm(false); load()
    } catch(e:any) { showToast(e.message, false) }
    finally { setLoading(false) }
  }

  const del = async (id: number) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await fetch(`/api/clients?id=${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } })
      showToast('✓ Cliente eliminado'); load()
    } catch(e:any) { showToast(e.message, false) }
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>👥 Clientes</span>
        <input style={{ ...S.input, width:200 }} placeholder="Buscar nombre, DNI, tel..." value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value) }} />
        <button onClick={openNew} style={S.btn('var(--accent)')}>+ Nuevo cliente</button>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Nombre','DNI','Teléfono','C.P.','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}
                onMouseEnter={e => (e.currentTarget.style.background='var(--s2)')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <td style={{ ...S.td, fontWeight:600 }}>{c.name}</td>
                <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{c.dni || '—'}</td>
                <td style={S.td}>{c.phone || '—'}</td>
                <td style={S.td}>{c.cp || '—'}</td>
                <td style={S.td}>
                  <div style={{ display:'flex', gap:5 }}>
                    <button onClick={() => openEdit(c)} style={{ ...S.btnOut, color:'var(--accent)', borderColor:'var(--accent-dim)', fontSize:10 }}>Editar</button>
                    <button onClick={() => del(c.id)} style={{ ...S.btnOut, color:'var(--red)', borderColor:'var(--red-dim)', fontSize:10 }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {!clients.length && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Sin clientes</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if(e.target===e.currentTarget) setShowForm(false) }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:440, boxShadow:'0 40px 80px rgba(0,0,0,.6)' }}>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:20 }}>{editing ? '✏️ Editar cliente' : '👤 Nuevo cliente'}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={S.label}>Nombre *</label>
                <input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nombre completo" autoFocus />
              </div>
              <div>
                <label style={S.label}>DNI / NIF</label>
                <input style={S.input} value={form.dni||''} onChange={e=>setForm({...form,dni:e.target.value})} placeholder="12345678A" />
              </div>
              <div>
                <label style={S.label}>Teléfono</label>
                <input style={S.input} value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="600 000 000" />
              </div>
              <div>
                <label style={S.label}>Código Postal</label>
                <input style={S.input} value={form.cp||''} onChange={e=>setForm({...form,cp:e.target.value})} placeholder="14900" />
              </div>
              <div>
                <label style={S.label}>Notas</label>
                <input style={S.input} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Observaciones..." />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={S.btnOut}>Cancelar</button>
              <button onClick={save} disabled={loading} style={S.btn('var(--accent)')}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:toast.ok?'var(--green)':'var(--red)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, zIndex:999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
