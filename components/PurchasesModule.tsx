'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { printPurchasePDF, printRebuPDF, printDepositPDF } from '@/lib/pdf-purchases'

const fmt  = (n: number) => (n || 0).toFixed(2).replace('.', ',') + ' €'
const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')

const S = {
  input:   { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 11px', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', width:'100%' },
  label:   { fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:4 },
  card:    { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px' },
  btn:     (c='var(--accent)') => ({ padding:'8px 14px', borderRadius:6, border:'none', background:c, color: c==='var(--amber)'?'#000':'#fff', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }),
  btnOut:  { padding:'6px 10px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' },
  badge:   (color: string, bg: string) => ({ display:'inline-flex', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, color, background:bg }),
  modal:   { position:'fixed' as const, inset:0, background:'rgba(0,0,0,.8)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)' },
  mBox:    { background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:680, maxHeight:'92vh', overflowY:'auto' as const, boxShadow:'0 40px 80px rgba(0,0,0,.6)' },
  th:      { textAlign:'left' as const, fontSize:10, color:'var(--text2)', fontWeight:600, padding:'6px 10px', borderBottom:'1px solid var(--border)', textTransform:'uppercase' as const, letterSpacing:'.05em' },
  td:      { padding:'9px 10px', borderBottom:'1px solid var(--border)', fontSize:12, verticalAlign:'middle' as const },
}

type Tab = 'facturas' | 'rebu' | 'depositos'
const STATUS_COLORS: Record<string, [string, string]> = {
  activo:      ['var(--green)',  'var(--green-dim)'],
  vendido:     ['var(--accent)', 'var(--accent-dim)'],
  recuperado:  ['var(--teal)',   'var(--teal-dim)'],
  caducado:    ['var(--red)',    'var(--red-dim)'],
  cancelado:   ['var(--text3)', 'var(--s3)'],
}

interface PurchasesModuleProps {
  token: string
  categories: any[]
}

export default function PurchasesModule({ token, categories }: PurchasesModuleProps) {
  const [tab, setTab]                 = useState<Tab>('facturas')
  const [purchases, setPurchases]     = useState<any[]>([])
  const [rebuList, setRebuList]       = useState<any[]>([])
  const [deposits, setDeposits]       = useState<any[]>([])
  const [loading, setLoading]         = useState(false)
  const [toast, setToast]             = useState<string | null>(null)
  const [modal, setModal]             = useState<'factura' | 'rebu' | 'deposito' | 'status' | null>(null)
  const [detailId, setDetailId]       = useState<number | null>(null)
  const [detail, setDetail]           = useState<any>(null)
  const [statusTarget, setStatusTarget] = useState<any>(null)

  // Form state
  const [form, setForm]   = useState<any>({})
  const [items, setItems] = useState<any[]>([{ name:'', emoji:'📦', category_id:'', qty:1, unit_cost:0, sale_price:0, iva_rate:21 }])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      if (tab === 'facturas') {
        const res = await fetch('/api/purchases', { headers: { Authorization: `Bearer ${token}` } })
        const j = await res.json(); setPurchases(j.data || [])
      } else if (tab === 'rebu') {
        const res = await fetch('/api/rebu-purchases', { headers: { Authorization: `Bearer ${token}` } })
        const j = await res.json(); setRebuList(j.data || [])
      } else {
        const res = await fetch('/api/deposits', { headers: { Authorization: `Bearer ${token}` } })
        const j = await res.json(); setDeposits(j.data || [])
      }
    } catch { showToast('Error al cargar datos') } finally { setLoading(false) }
  }, [token, tab])

  useEffect(() => { load() }, [load])

  const loadDetail = async (type: Tab, id: number) => {
    setDetailId(id)
    const url = type === 'facturas' ? `/api/purchases?id=${id}`
              : type === 'rebu'     ? `/api/rebu-purchases?id=${id}`
              : `/api/deposits?id=${id}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const j = await res.json(); setDetail(j.data)
  }

  // ── SAVE FACTURA ──
  const saveFactura = async () => {
    if (!form.supplier_name || !form.supplier_nif || !form.supplier_invoice || !form.invoice_date || !form.invoice_total)
      return showToast('Completa todos los campos del proveedor')
    if (items.some(i => !i.name || !i.sale_price))
      return showToast('Todos los artículos necesitan nombre y precio de venta')
    setLoading(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, items }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast(`✓ Compra ${j.data.purchase.ref} registrada — ${j.data.products.length} artículos creados`)
      setModal(null); setForm({}); setItems([{ name:'', emoji:'📦', category_id:'', qty:1, unit_cost:0, sale_price:0, iva_rate:21 }])
      // Auto print
      printPurchasePDF(j.data.purchase, items)
      load()
    } catch (e: any) { showToast(e.message) } finally { setLoading(false) }
  }

  // ── SAVE REBU ──
  const saveRebu = async () => {
    if (!form.seller_name || !form.seller_dni || !form.description || !form.buy_price || !form.sale_price)
      return showToast('Completa todos los campos obligatorios')
    setLoading(true)
    try {
      const res = await fetch('/api/rebu-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast(`✓ Compra REBU ${j.data.purchase.ref} registrada`)
      setModal(null); setForm({})
      printRebuPDF(j.data.purchase)
      load()
    } catch (e: any) { showToast(e.message) } finally { setLoading(false) }
  }

  // ── SAVE DEPOSIT ──
  const saveDeposit = async () => {
    if (!form.client_name || !form.client_dni || !form.description || !form.agreed_price || !form.expiry_date)
      return showToast('Completa todos los campos obligatorios')
    setLoading(true)
    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, deposit_type: form.deposit_type || 'deposito' }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast(`✓ ${form.deposit_type === 'empeno' ? 'Empeño' : 'Depósito'} ${j.data.deposit.ref} registrado`)
      setModal(null); setForm({})
      printDepositPDF(j.data.deposit)
      load()
    } catch (e: any) { showToast(e.message) } finally { setLoading(false) }
  }

  // ── UPDATE DEPOSIT STATUS ──
  const updateStatus = async (newStatus: string) => {
    if (!statusTarget) return
    setLoading(true)
    try {
      const res = await fetch('/api/deposits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: statusTarget.id, status: newStatus, event_detail: `Estado cambiado a ${newStatus}` }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast(`✓ Estado actualizado a "${newStatus}"`)
      setStatusTarget(null)
      load()
    } catch (e: any) { showToast(e.message) } finally { setLoading(false) }
  }

  const setF = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))
  const setItem = (i: number, k: string, v: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>🛒 Módulo de Compras</span>
        {/* Tab pills */}
        {([['facturas','🧾','Facturas (nuevos)'],['rebu','♻️','Compras REBU'],['depositos','🏷️','Empeños / Depósitos']] as [Tab,string,string][]).map(([t,icon,label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'6px 13px', borderRadius:20, border:`1px solid ${tab===t?'var(--accent)':'var(--border)'}`,
            background: tab===t?'var(--accent-dim)':'none', color: tab===t?'var(--accent)':'var(--text2)',
            cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit',
          }}>{icon} {label}</button>
        ))}
        <button onClick={load} style={{ ...S.btnOut, fontSize:11 }}>🔄</button>
        <button onClick={() => { setForm(tab === 'depositos' ? { deposit_type:'deposito', commission_pct:20 } : {}); setItems([{ name:'', emoji:'📦', category_id:'', qty:1, unit_cost:0, sale_price:0, iva_rate:21 }]); setModal(tab === 'facturas' ? 'factura' : tab === 'rebu' ? 'rebu' : 'deposito') }}
          style={S.btn('var(--amber)')}>
          + {tab === 'facturas' ? 'Registrar factura' : tab === 'rebu' ? 'Compra REBU' : 'Nuevo depósito/empeño'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 20px', minHeight:0 }}>

        {/* ── FACTURAS ── */}
        {tab === 'facturas' && (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Referencia','Proveedor','NIF prov.','Nº Factura','Fecha','Total','Artículos','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {!purchases.length && <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Sin registros</td></tr>}
              {purchases.map(p => (
                <tr key={p.id} onMouseEnter={e => (e.currentTarget.style.background='var(--s2)')} onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <td style={S.td}><span style={{ fontFamily:'monospace', fontWeight:600, color:'var(--accent)' }}>{p.ref}</span></td>
                  <td style={{ ...S.td, fontWeight:600 }}>{p.supplier_name}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{p.supplier_nif}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{p.supplier_invoice}</td>
                  <td style={{ ...S.td, fontSize:11 }}>{p.invoice_date}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--green)' }}>{fmt(parseFloat(p.invoice_total))}</td>
                  <td style={S.td}><span style={S.badge('var(--accent)','var(--accent-dim)')}>{p.items?.length || 0} arts.</span></td>
                  <td style={S.td}>
                    <button onClick={() => { loadDetail('facturas', p.id); setDetail(null) }} style={{ ...S.btnOut, fontSize:10, marginRight:4 }}>Ver</button>
                    <button onClick={async () => { await loadDetail('facturas', p.id); }} style={{ ...S.btnOut, fontSize:10, color:'var(--amber)', borderColor:'var(--amber-dim)' }}>🖨️ PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── REBU ── */}
        {tab === 'rebu' && (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Referencia','Vendedor','DNI','Artículo','Compra','Venta prev.','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {!rebuList.length && <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Sin registros</td></tr>}
              {rebuList.map(r => (
                <tr key={r.id} onMouseEnter={e => (e.currentTarget.style.background='var(--s2)')} onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <td style={S.td}><span style={{ fontFamily:'monospace', fontWeight:600, color:'var(--teal)' }}>{r.ref}</span></td>
                  <td style={{ ...S.td, fontWeight:600 }}>{r.seller_name}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{r.seller_dni}</td>
                  <td style={S.td}>{r.description}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--red)' }}>{fmt(parseFloat(r.buy_price))}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', color:'var(--green)' }}>{fmt(parseFloat(r.sale_price))}</td>
                  <td style={S.td}>
                    <button onClick={() => printRebuPDF(r)} style={{ ...S.btnOut, fontSize:10, color:'var(--amber)', borderColor:'var(--amber-dim)' }}>🖨️ PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── DEPÓSITOS ── */}
        {tab === 'depositos' && (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Referencia','Tipo','Cliente','DNI','Artículo','Valor','Caducidad','Estado','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {!deposits.length && <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Sin registros</td></tr>}
              {deposits.map(d => {
                const [sc, sbg] = STATUS_COLORS[d.status] || ['var(--text2)','var(--s3)']
                return (
                  <tr key={d.id} onMouseEnter={e => (e.currentTarget.style.background='var(--s2)')} onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <td style={S.td}><span style={{ fontFamily:'monospace', fontWeight:600, color:'var(--amber)' }}>{d.ref}</span></td>
                    <td style={S.td}><span style={S.badge(d.deposit_type==='empeno'?'var(--red)':'var(--teal)', d.deposit_type==='empeno'?'var(--red-dim)':'var(--teal-dim)')}>{d.deposit_type==='empeno'?'🏷️ Empeño':'📦 Depósito'}</span></td>
                    <td style={{ ...S.td, fontWeight:600 }}>{d.client_name}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{d.client_dni}</td>
                    <td style={S.td}>{d.description}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', color:'var(--green)' }}>{fmt(parseFloat(d.agreed_price))}</td>
                    <td style={{ ...S.td, fontSize:11, color: d.status==='activo'?'var(--amber)':'var(--text3)' }}>{d.expiry_date}</td>
                    <td style={S.td}><span style={S.badge(sc, sbg)}>{d.status}</span></td>
                    <td style={S.td}>
                      <button onClick={() => printDepositPDF(d)} style={{ ...S.btnOut, fontSize:10, color:'var(--amber)', borderColor:'var(--amber-dim)', marginRight:4 }}>🖨️ PDF</button>
                      {d.status === 'activo' && (
                        <button onClick={() => setStatusTarget(d)} style={{ ...S.btnOut, fontSize:10, color:'var(--accent)', borderColor:'var(--accent-dim)' }}>Cambiar estado</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL: NUEVA FACTURA
      ══════════════════════════════════════════════════════════ */}
      {modal === 'factura' && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setModal(null) }}>
          <div style={S.mBox}>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:18 }}>🧾 Registrar Factura de Compra</h3>

            <div style={{ background:'var(--s2)', borderRadius:8, padding:12, marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Datos del Proveedor y Factura</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={S.label}>Nombre proveedor *</label><input style={S.input} value={form.supplier_name||''} onChange={e => setF('supplier_name', e.target.value)} placeholder="Distribuidor S.A." /></div>
                <div><label style={S.label}>NIF / CIF proveedor *</label><input style={S.input} value={form.supplier_nif||''} onChange={e => setF('supplier_nif', e.target.value)} placeholder="B12345678" /></div>
                <div><label style={S.label}>Nº factura proveedor *</label><input style={S.input} value={form.supplier_invoice||''} onChange={e => setF('supplier_invoice', e.target.value)} placeholder="FAC-2026-001" /></div>
                <div><label style={S.label}>Fecha factura *</label><input style={S.input} type="date" value={form.invoice_date||''} onChange={e => setF('invoice_date', e.target.value)} /></div>
                <div><label style={S.label}>Importe total factura (€) *</label><input style={S.input} type="number" step="0.01" value={form.invoice_total||''} onChange={e => setF('invoice_total', parseFloat(e.target.value))} placeholder="0.00" /></div>
                <div><label style={S.label}>Observaciones</label><input style={S.input} value={form.notes||''} onChange={e => setF('notes', e.target.value)} placeholder="Opcional" /></div>
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.05em' }}>Artículos a crear ({items.length})</span>
                <button onClick={() => setItems(p => [...p, { name:'', emoji:'📦', category_id:'', qty:1, unit_cost:0, sale_price:0, iva_rate:21 }])} style={{ ...S.btnOut, fontSize:11, color:'var(--green)', borderColor:'var(--green-dim)' }}>+ Añadir artículo</button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:8, padding:10, marginBottom:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                    <div style={{ gridColumn:'1/-1', display:'flex', gap:8 }}>
                      <div style={{ width:60 }}><label style={S.label}>Emoji</label><input style={S.input} value={item.emoji} onChange={e => setItem(idx,'emoji',e.target.value)} maxLength={4} /></div>
                      <div style={{ flex:1 }}><label style={S.label}>Nombre del artículo *</label><input style={S.input} value={item.name} onChange={e => setItem(idx,'name',e.target.value)} placeholder="Nombre del producto" /></div>
                      <div style={{ width:40, display:'flex', alignItems:'flex-end', paddingBottom:2 }}>
                        {items.length > 1 && <button onClick={() => setItems(p => p.filter((_,i) => i !== idx))} style={{ ...S.btnOut, color:'var(--red)', borderColor:'var(--red-dim)', fontSize:12 }}>✕</button>}
                      </div>
                    </div>
                    <div><label style={S.label}>Categoría</label>
                      <select style={S.input} value={item.category_id} onChange={e => setItem(idx,'category_id',parseInt(e.target.value))}>
                        <option value="">Sin categoría</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </div>
                    <div><label style={S.label}>Unidades</label><input style={S.input} type="number" min="1" value={item.qty} onChange={e => setItem(idx,'qty',parseInt(e.target.value))} /></div>
                    <div><label style={S.label}>IVA %</label>
                      <select style={S.input} value={item.iva_rate} onChange={e => setItem(idx,'iva_rate',parseInt(e.target.value))}>
                        <option value={4}>4% — Básico</option>
                        <option value={10}>10% — Reducido</option>
                        <option value={21}>21% — General</option>
                      </select>
                    </div>
                    <div><label style={S.label}>Coste unitario (€)</label><input style={S.input} type="number" step="0.01" min="0" value={item.unit_cost} onChange={e => setItem(idx,'unit_cost',parseFloat(e.target.value))} /></div>
                    <div><label style={S.label}>Precio venta (€) *</label><input style={S.input} type="number" step="0.01" min="0" value={item.sale_price} onChange={e => setItem(idx,'sale_price',parseFloat(e.target.value))} /></div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setModal(null)} style={S.btnOut}>Cancelar</button>
              <button onClick={saveFactura} disabled={loading} style={S.btn('var(--amber)')}>💾 Registrar y generar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL: COMPRA REBU
      ══════════════════════════════════════════════════════════ */}
      {modal === 'rebu' && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setModal(null) }}>
          <div style={S.mBox}>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>♻️ Registrar Compra REBU</h3>
            <p style={{ color:'var(--text2)', fontSize:11, marginBottom:18 }}>Compra de artículo de segunda mano a particular — DNI obligatorio (Art. 135-139 LIVA)</p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              <div style={{ background:'var(--s2)', borderRadius:8, padding:12, gridColumn:'1/-1' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Datos del Vendedor (Particular)</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={S.label}>Nombre completo *</label><input style={S.input} value={form.seller_name||''} onChange={e => setF('seller_name',e.target.value)} /></div>
                  <div><label style={S.label}>DNI / NIE *</label><input style={S.input} value={form.seller_dni||''} onChange={e => setF('seller_dni',e.target.value)} placeholder="12345678A" /></div>
                  <div><label style={S.label}>Teléfono</label><input style={S.input} value={form.seller_phone||''} onChange={e => setF('seller_phone',e.target.value)} /></div>
                  <div><label style={S.label}>Dirección</label><input style={S.input} value={form.seller_address||''} onChange={e => setF('seller_address',e.target.value)} /></div>
                </div>
              </div>
              <div style={{ background:'var(--s2)', borderRadius:8, padding:12, gridColumn:'1/-1' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Artículo</div>
                <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr', gap:10 }}>
                  <div><label style={S.label}>Emoji</label><input style={S.input} value={form.emoji||'♻️'} onChange={e => setF('emoji',e.target.value)} maxLength={4} /></div>
                  <div style={{ gridColumn:'2/-1' }}><label style={S.label}>Descripción *</label><input style={S.input} value={form.description||''} onChange={e => setF('description',e.target.value)} placeholder="Ej: iPhone 12 64GB negro" /></div>
                  <div><label style={S.label}>Categoría</label>
                    <select style={S.input} value={form.category_id||''} onChange={e => setF('category_id',parseInt(e.target.value))}>
                      <option value="">Sin categoría</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>Precio compra (€) *</label><input style={S.input} type="number" step="0.01" min="0" value={form.buy_price||''} onChange={e => setF('buy_price',parseFloat(e.target.value))} /></div>
                  <div><label style={S.label}>Precio venta prev. (€) *</label><input style={S.input} type="number" step="0.01" min="0" value={form.sale_price||''} onChange={e => setF('sale_price',parseFloat(e.target.value))} /></div>
                </div>
                {form.buy_price > 0 && form.sale_price > 0 && (
                  <div style={{ marginTop:8, fontSize:11, color:'var(--text2)', background:'var(--s3)', padding:'6px 10px', borderRadius:6 }}>
                    Margen: <b style={{ color:'var(--green)' }}>{fmtN(form.sale_price - form.buy_price)} €</b> · IVA s/margen: <b style={{ color:'var(--amber)' }}>{fmtN((form.sale_price - form.buy_price) * 21 / 121)} €</b>
                  </div>
                )}
              </div>
              <div style={{ gridColumn:'1/-1' }}><label style={S.label}>Observaciones</label><input style={S.input} value={form.notes||''} onChange={e => setF('notes',e.target.value)} /></div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setModal(null)} style={S.btnOut}>Cancelar</button>
              <button onClick={saveRebu} disabled={loading} style={S.btn('var(--teal)')}>💾 Registrar y generar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL: DEPÓSITO / EMPEÑO
      ══════════════════════════════════════════════════════════ */}
      {modal === 'deposito' && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setModal(null) }}>
          <div style={S.mBox}>
            {/* Type selector */}
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {[['deposito','📦 Depósito en venta','El cliente deja el artículo, cobra si se vende'],['empeno','🏷️ Empeño','El cliente deja el artículo a cambio de un préstamo']].map(([type,label,desc]) => (
                <div key={type} onClick={() => setF('deposit_type',type)} style={{
                  flex:1, padding:12, borderRadius:8, border:`2px solid ${form.deposit_type===type?'var(--amber)':'var(--border)'}`,
                  background: form.deposit_type===type ? 'var(--amber-dim)' : 'var(--s2)', cursor:'pointer',
                }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:4, color: form.deposit_type===type?'var(--amber)':'var(--text)' }}>{label}</div>
                  <div style={{ fontSize:11, color:'var(--text2)' }}>{desc}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              <div style={{ background:'var(--s2)', borderRadius:8, padding:12, gridColumn:'1/-1' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Datos del Cliente</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={S.label}>Nombre completo *</label><input style={S.input} value={form.client_name||''} onChange={e => setF('client_name',e.target.value)} /></div>
                  <div><label style={S.label}>DNI / NIE *</label><input style={S.input} value={form.client_dni||''} onChange={e => setF('client_dni',e.target.value)} placeholder="12345678A" /></div>
                  <div><label style={S.label}>Teléfono</label><input style={S.input} value={form.client_phone||''} onChange={e => setF('client_phone',e.target.value)} /></div>
                  <div><label style={S.label}>Dirección</label><input style={S.input} value={form.client_address||''} onChange={e => setF('client_address',e.target.value)} /></div>
                </div>
              </div>

              <div style={{ background:'var(--s2)', borderRadius:8, padding:12, gridColumn:'1/-1' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Artículo y Condiciones</div>
                <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 1fr', gap:10 }}>
                  <div><label style={S.label}>Emoji</label><input style={S.input} value={form.emoji||'📦'} onChange={e => setF('emoji',e.target.value)} maxLength={4} /></div>
                  <div style={{ gridColumn:'2/-1' }}><label style={S.label}>Descripción *</label><input style={S.input} value={form.description||''} onChange={e => setF('description',e.target.value)} placeholder="Ej: Reloj Casio dorado" /></div>
                  <div><label style={S.label}>Categoría</label>
                    <select style={S.input} value={form.category_id||''} onChange={e => setF('category_id',parseInt(e.target.value))}>
                      <option value="">Sin categoría</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={S.label}>Valor tasado (€)</label><input style={S.input} type="number" step="0.01" min="0" value={form.appraised_value||''} onChange={e => setF('appraised_value',parseFloat(e.target.value))} /></div>
                  <div><label style={S.label}>{form.deposit_type==='empeno'?'Importe prestado (€) *':'Precio venta acordado (€) *'}</label><input style={S.input} type="number" step="0.01" min="0" value={form.agreed_price||''} onChange={e => setF('agreed_price',parseFloat(e.target.value))} /></div>
                  <div><label style={S.label}>Comisión tienda (%)</label><input style={S.input} type="number" step="0.5" min="0" max="100" value={form.commission_pct||20} onChange={e => setF('commission_pct',parseFloat(e.target.value))} /></div>
                  <div><label style={S.label}>Fecha entrada</label><input style={S.input} type="date" value={form.entry_date||new Date().toISOString().slice(0,10)} onChange={e => setF('entry_date',e.target.value)} /></div>
                  <div><label style={S.label}>Fecha límite / caducidad *</label><input style={S.input} type="date" value={form.expiry_date||''} onChange={e => setF('expiry_date',e.target.value)} /></div>
                </div>
                {form.agreed_price > 0 && form.commission_pct > 0 && (
                  <div style={{ marginTop:8, fontSize:11, color:'var(--text2)', background:'var(--s3)', padding:'6px 10px', borderRadius:6 }}>
                    Comisión tienda: <b style={{ color:'var(--amber)' }}>{fmtN(form.agreed_price * form.commission_pct / 100)} €</b> ·
                    Cliente {form.deposit_type==='empeno'?'recoge':'recibe'}: <b style={{ color:'var(--green)' }}>{fmtN(form.agreed_price * (1 - form.commission_pct / 100))} €</b>
                  </div>
                )}
              </div>
              <div style={{ gridColumn:'1/-1' }}><label style={S.label}>Observaciones / Condiciones adicionales</label><input style={S.input} value={form.notes||''} onChange={e => setF('notes',e.target.value)} /></div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setModal(null)} style={S.btnOut}>Cancelar</button>
              <button onClick={saveDeposit} disabled={loading} style={S.btn('var(--amber)')}>💾 Registrar y generar PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE STATUS MODAL ── */}
      {statusTarget && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setStatusTarget(null) }}>
          <div style={{ ...S.mBox, width:380, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🔄</div>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Cambiar estado</h3>
            <p style={{ color:'var(--text2)', fontSize:11, marginBottom:20 }}>{statusTarget.ref} · {statusTarget.client_name}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[['vendido','✅ Vendido','El artículo ha sido vendido','var(--green)'],
                ['recuperado','↩️ Recuperado','El cliente ha recogido el artículo','var(--teal)'],
                ['caducado','⏰ Caducado','Ha vencido el plazo sin recogida','var(--amber)'],
                ['cancelado','❌ Cancelado','Cancelado por acuerdo','var(--red)'],
              ].map(([status,label,desc,color]) => (
                <button key={status} onClick={() => updateStatus(status)} style={{
                  padding:'10px 16px', borderRadius:8, border:`1px solid ${color}`,
                  background:'none', color: color, cursor:'pointer', fontFamily:'inherit',
                  fontSize:13, fontWeight:600, textAlign:'left' as const,
                }}>
                  {label} <span style={{ fontSize:11, fontWeight:400, color:'var(--text2)', marginLeft:8 }}>{desc}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStatusTarget(null)} style={{ ...S.btnOut, width:'100%', marginTop:12 }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'var(--green)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, zIndex:999, boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
