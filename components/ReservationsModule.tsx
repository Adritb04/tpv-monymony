'use client'
import { useState, useEffect, useCallback } from 'react'

const fmt  = (n: number) => (n||0).toFixed(2).replace('.',',') + ' €'
const fmtN = (n: number) => (n||0).toFixed(2).replace('.',',')

const NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE    || 'MI TIENDA',
  razon_social: process.env.NEXT_PUBLIC_NEGOCIO_RAZON_SOCIAL || '',
  nif:       process.env.NEXT_PUBLIC_NEGOCIO_NIF       || '',
  direccion: process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION || '',
  cp:        process.env.NEXT_PUBLIC_NEGOCIO_CP        || '',
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD || '',
  telefono:  process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO  || '',
}

const S = {
  card:   { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  input:  { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', width:'100%' },
  label:  { fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:4 },
  btn:    (bg='var(--accent)', color='#fff') => ({ padding:'8px 16px', borderRadius:8, border:'none', background:bg, color, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }),
  btnOut: { padding:'6px 12px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' },
  badge:  (c: string, bg: string) => ({ display:'inline-flex', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, color:c, background:bg }),
}

interface ReservationsModuleProps { token: string; user: any }

export default function ReservationsModule({ token, user }: ReservationsModuleProps) {
  const [reservations, setReservations] = useState<any[]>([])
  const [clients, setClients]           = useState<any[]>([])
  const [products, setProducts]         = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('activa')
  const [loading, setLoading]           = useState(false)
  const [toast, setToast]               = useState<{msg:string;ok:boolean}|null>(null)
  const [showForm, setShowForm]         = useState(false)
  const [abonoModal, setAbonoModal]     = useState<any>(null)
  const [abonoImporte, setAbonoImporte] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<any[]>([])

  const [form, setForm] = useState<any>({
    client_id: '', product_id: '', qty: 1, price: 0, abono: 0, plazo_dias: 15, notes: ''
  })

  const showToast = (msg: string, ok = true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500) }

  const load = useCallback(async () => {
    try {
      const [rRes, pRes] = await Promise.all([
        fetch(`/api/reservations?status=${statusFilter}`, { headers:{ Authorization:`Bearer ${token}` } }),
        fetch('/api/products', { headers:{ Authorization:`Bearer ${token}` } }),
      ])
      const rj = await rRes.json(); setReservations(rj.data || [])
      const pj = await pRes.json(); setProducts(pj.data || [])
    } catch(e:any) { showToast(e.message, false) }
  }, [token, statusFilter])

  useEffect(() => { load() }, [load])

  const searchClients = async (q: string) => {
    setClientSearch(q)
    if (q.length < 2) { setClientResults([]); return }
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`, { headers:{ Authorization:`Bearer ${token}` } })
    const j = await res.json()
    setClientResults(j.data || [])
  }

  const selectClient = (c: any) => {
    setForm((p: any) => ({ ...p, client_id: c.id }))
    setClientSearch(c.name)
    setClientResults([])
  }

  const selectProduct = (id: string) => {
    const p = products.find(x => x.id === parseInt(id))
    setForm((prev: any) => ({ ...prev, product_id: id, price: p ? parseFloat(p.price) : prev.price }))
  }

  const createReservation = async () => {
    if (!form.client_id) return showToast('Selecciona un cliente', false)
    if (!form.product_id) return showToast('Selecciona un producto', false)
    setLoading(true)
    try {
      const prod = products.find(p => p.id === parseInt(form.product_id))
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          client_id: parseInt(form.client_id),
          product_id: parseInt(form.product_id),
          product_name: prod?.name || '',
          product_emoji: prod?.emoji || '📦',
          qty: parseInt(form.qty) || 1,
          price: parseFloat(form.price) || 0,
          abono: parseFloat(form.abono) || 0,
          plazo_dias: parseInt(form.plazo_dias) || 15,
          notes: form.notes,
        })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Reserva creada')
      setShowForm(false)
      setForm({ client_id:'', product_id:'', qty:1, price:0, abono:0, plazo_dias:15, notes:'' })
      setClientSearch('')
      load()
      printReservationTicket(j.data)
    } catch(e:any) { showToast(e.message, false) }
    finally { setLoading(false) }
  }

  const doAbono = async () => {
    const importe = parseFloat(abonoImporte)
    if (!importe || importe <= 0) return showToast('Introduce un importe válido', false)
    setLoading(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ action:'abono', id: abonoModal.id, importe })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Abono registrado')
      setAbonoModal(null); setAbonoImporte(''); load()
    } catch(e:any) { showToast(e.message, false) }
    finally { setLoading(false) }
  }

  const cobrar = async (r: any) => {
    if (!confirm(`¿Cobrar reserva de ${r.clients?.name}? Se generará el ticket final.`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ action:'cobrar', id: r.id })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Reserva cobrada')
      load()
      printFinalTicket(j.data)
    } catch(e:any) { showToast(e.message, false) }
    finally { setLoading(false) }
  }

  const cancelar = async (r: any) => {
    if (!confirm('¿Cancelar esta reserva? Se liberará el stock reservado.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({ action:'cancelar', id: r.id })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Reserva cancelada'); load()
    } catch(e:any) { showToast(e.message, false) }
    finally { setLoading(false) }
  }

  const printReservationTicket = (r: any) => {
    const w = window.open('', '_blank', 'width=400,height=700')!
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reserva</title>
    <style>
      @page{size:80mm auto;margin:0}
      body{font-family:'Courier New',monospace;font-size:13px;font-weight:600;color:#000;width:72mm;padding:4mm 2mm;margin:0}
      .center{text-align:center}.bold{font-weight:800}.row{display:flex;justify-content:space-between;margin:2px 0}
      .div{border-top:1px dashed #000;margin:4px 0}.divs{border-top:2px solid #000;margin:4px 0}
      .big{font-size:15px;font-weight:800}
    </style></head><body>
    <div class="center bold" style="font-size:15px">${NEGOCIO.nombre}</div>
    ${NEGOCIO.razon_social ? `<div class="center" style="font-size:11px">${NEGOCIO.razon_social}</div>` : ''}
    <div class="center" style="font-size:11px">NIF: ${NEGOCIO.nif}</div>
    <div class="center" style="font-size:11px">${NEGOCIO.direccion}</div>
    <div class="center" style="font-size:11px">${NEGOCIO.cp} ${NEGOCIO.localidad}</div>
    ${NEGOCIO.telefono ? `<div class="center" style="font-size:11px">Tel: ${NEGOCIO.telefono}</div>` : ''}
    <div class="div"></div>
    <div class="center bold big">** RESERVA **</div>
    <div class="div"></div>
    <div class="row"><span>Fecha</span><span>${new Date().toLocaleDateString('es-ES')}</span></div>
    <div class="row"><span>Hora</span><span>${new Date().toLocaleTimeString('es-ES')}</span></div>
    <div class="div"></div>
    <div class="bold">CLIENTE</div>
    <div class="row"><span>Nombre</span><span>${r.clients?.name || ''}</span></div>
    ${r.clients?.dni ? `<div class="row"><span>DNI</span><span>${r.clients.dni}</span></div>` : ''}
    ${r.clients?.phone ? `<div class="row"><span>Tel</span><span>${r.clients.phone}</span></div>` : ''}
    <div class="div"></div>
    <div class="bold">ARTÍCULO</div>
    <div class="row"><span>${r.product_emoji} ${r.product_name}</span><span>x${r.qty}</span></div>
    <div class="row"><span>Precio</span><span>${fmtN(parseFloat(r.price))} €</span></div>
    <div class="div"></div>
    <div class="row"><span>Abono entregado</span><span>${fmtN(parseFloat(r.abono))} €</span></div>
    <div class="row bold"><span>Pendiente</span><span>${fmtN(parseFloat(r.price) * r.qty - parseFloat(r.abono))} €</span></div>
    <div class="div"></div>
    <div class="row bold"><span>Plazo reserva</span><span>${r.plazo_dias} días</span></div>
    <div class="row"><span>Fecha límite</span><span>${r.plazo_fecha}</span></div>
    <div class="div"></div>
    <div class="center" style="font-size:11px">El artículo quedará reservado hasta la fecha indicada.</div>
    <div class="center" style="font-size:11px">Pasado el plazo, la reserva podrá cancelarse.</div>
    <div style="height:20mm"></div>
    </body></html>`)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const printFinalTicket = (r: any) => {
    const w = window.open('', '_blank', 'width=400,height=700')!
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket Reserva Cobrada</title>
    <style>
      @page{size:80mm auto;margin:0}
      body{font-family:'Courier New',monospace;font-size:13px;font-weight:600;color:#000;width:72mm;padding:4mm 2mm;margin:0}
      .center{text-align:center}.bold{font-weight:800}.row{display:flex;justify-content:space-between;margin:2px 0}
      .div{border-top:1px dashed #000;margin:4px 0}.divs{border-top:2px solid #000;margin:4px 0}
      .big{font-size:17px;font-weight:800}
    </style></head><body>
    <div class="center bold" style="font-size:15px">${NEGOCIO.nombre}</div>
    ${NEGOCIO.razon_social ? `<div class="center" style="font-size:11px">${NEGOCIO.razon_social}</div>` : ''}
    <div class="center" style="font-size:11px">NIF: ${NEGOCIO.nif}</div>
    <div class="div"></div>
    <div class="center bold big">RESERVA COBRADA</div>
    <div class="div"></div>
    <div class="row"><span>Fecha cobro</span><span>${new Date().toLocaleDateString('es-ES')}</span></div>
    <div class="div"></div>
    <div class="bold">CLIENTE</div>
    <div class="row"><span>${r.clients?.name || ''}</span></div>
    <div class="div"></div>
    <div class="bold">ARTÍCULO</div>
    <div class="row"><span>${r.product_emoji} ${r.product_name}</span><span>x${r.qty}</span></div>
    <div class="divs"></div>
    <div class="row big"><span>TOTAL</span><span>${fmtN(parseFloat(r.price) * r.qty)} €</span></div>
    <div class="row"><span>Abono previo</span><span>${fmtN(parseFloat(r.abono))} €</span></div>
    <div class="row bold"><span>Cobrado ahora</span><span>${fmtN(parseFloat(r.price) * r.qty - parseFloat(r.abono))} €</span></div>
    <div class="div"></div>
    <div class="center" style="font-size:11px">*** Gracias por su compra ***</div>
    <div style="height:20mm"></div>
    </body></html>`)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const pendiente = (r: any) => parseFloat(r.price) * r.qty - parseFloat(r.abono || 0)
  const isVencida = (r: any) => r.plazo_fecha && new Date(r.plazo_fecha) < new Date() && r.status === 'activa'

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, flexWrap:'wrap' }}>
        <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>📋 Reservas</span>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{ ...S.input, width:'auto', cursor:'pointer' }}>
          <option value="activa">Activas</option>
          <option value="cobrada">Cobradas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <button onClick={load} style={{ ...S.btnOut, fontSize:11 }}>🔄</button>
        <button onClick={() => setShowForm(true)} style={S.btn('var(--accent)')}>+ Nueva reserva</button>
      </div>

      {/* Reservations list */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {reservations.map(r => (
            <div key={r.id} style={{ ...S.card, border:`1px solid ${isVencida(r)?'var(--red-dim)':'var(--border)'}`, background: isVencida(r)?'var(--red-dim)':undefined }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{r.product_emoji} {r.product_name} <span style={{ fontFamily:'monospace', color:'var(--text2)', fontSize:12 }}>x{r.qty}</span></div>
                  <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>👤 {r.clients?.name} {r.clients?.phone ? `· ${r.clients.phone}` : ''}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'monospace', fontWeight:800, fontSize:15, color:'var(--accent)' }}>{fmt(parseFloat(r.price) * r.qty)}</div>
                  {isVencida(r) && <span style={{ ...S.badge('var(--red)','var(--red-dim)'), fontSize:9 }}>⚠️ VENCIDA</span>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                <div style={{ background:'var(--s1)', borderRadius:6, padding:'6px 10px', textAlign:'center' as const }}>
                  <div style={{ fontSize:9, color:'var(--text3)', marginBottom:2 }}>ABONADO</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, color:'var(--green)', fontSize:13 }}>{fmt(parseFloat(r.abono||0))}</div>
                </div>
                <div style={{ background:'var(--s1)', borderRadius:6, padding:'6px 10px', textAlign:'center' as const }}>
                  <div style={{ fontSize:9, color:'var(--text3)', marginBottom:2 }}>PENDIENTE</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, color: pendiente(r)>0?'var(--amber)':'var(--green)', fontSize:13 }}>{fmt(pendiente(r))}</div>
                </div>
                <div style={{ background:'var(--s1)', borderRadius:6, padding:'6px 10px', textAlign:'center' as const }}>
                  <div style={{ fontSize:9, color:'var(--text3)', marginBottom:2 }}>PLAZO</div>
                  <div style={{ fontWeight:700, fontSize:12, color: isVencida(r)?'var(--red)':'var(--text)' }}>{r.plazo_fecha}</div>
                </div>
              </div>
              {r.notes && <div style={{ fontSize:11, color:'var(--text2)', marginBottom:8, fontStyle:'italic' }}>📝 {r.notes}</div>}
              {r.status === 'activa' && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <button onClick={() => { setAbonoModal(r); setAbonoImporte('') }} style={S.btn('var(--teal)')}>💰 Abono</button>
                  <button onClick={() => cobrar(r)} style={S.btn('var(--green)')}>✅ Cobrar</button>
                  <button onClick={() => printReservationTicket(r)} style={{ ...S.btnOut, fontSize:11 }}>🖨️ Ticket</button>
                  <button onClick={() => cancelar(r)} style={{ ...S.btnOut, color:'var(--red)', borderColor:'var(--red-dim)', fontSize:11 }}>✕ Cancelar</button>
                </div>
              )}
              {r.status === 'cobrada' && (
                <div style={{ display:'flex', gap:6 }}>
                  <span style={S.badge('var(--green)','var(--green-dim)')}>✓ Cobrada {r.cobrada_at ? new Date(r.cobrada_at).toLocaleDateString('es-ES') : ''}</span>
                  <button onClick={() => printFinalTicket(r)} style={{ ...S.btnOut, fontSize:10 }}>🖨️ Ticket</button>
                </div>
              )}
              {r.status === 'cancelada' && <span style={S.badge('var(--red)','var(--red-dim)')}>✕ Cancelada</span>}
            </div>
          ))}
          {!reservations.length && <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Sin reservas {statusFilter}</div>}
        </div>
      </div>

      {/* New Reservation Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if(e.target===e.currentTarget) setShowForm(false) }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 40px 80px rgba(0,0,0,.6)' }}>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:20 }}>📋 Nueva Reserva</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

              {/* Client search */}
              <div style={{ position:'relative' }}>
                <label style={S.label}>Cliente *</label>
                <input style={S.input} value={clientSearch}
                  onChange={e => searchClients(e.target.value)}
                  placeholder="Buscar cliente por nombre o DNI..." />
                {clientResults.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--s1)', border:'1px solid var(--border)', borderRadius:8, zIndex:10, maxHeight:180, overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
                    {clientResults.map(c => (
                      <div key={c.id} onClick={() => selectClient(c)}
                        style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:13 }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <span style={{ fontWeight:600 }}>{c.name}</span>
                        {c.dni && <span style={{ color:'var(--text2)', marginLeft:8, fontSize:11 }}>{c.dni}</span>}
                        {c.phone && <span style={{ color:'var(--text2)', marginLeft:8, fontSize:11 }}>{c.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {form.client_id && <div style={{ fontSize:10, color:'var(--green)', marginTop:3 }}>✓ Cliente seleccionado</div>}
              </div>

              {/* Product */}
              <div>
                <label style={S.label}>Producto *</label>
                <select style={S.input} value={form.product_id} onChange={e => selectProduct(e.target.value)}>
                  <option value="">Seleccionar producto...</option>
                  {products.filter(p=>p.active&&(p.stock-(p.stock_reserved||0))>0).map(p => (
                    <option key={p.id} value={p.id}>{p.emoji} {p.name} — Stock disp: {p.stock-(p.stock_reserved||0)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={S.label}>Cantidad</label>
                  <input style={S.input} type="number" min="1" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>Precio total (€)</label>
                  <input style={S.input} type="number" step="0.01" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>Abono inicial (€)</label>
                  <input style={S.input} type="number" step="0.01" min="0" value={form.abono} onChange={e=>setForm({...form,abono:e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label style={S.label}>Plazo (días)</label>
                  <input style={S.input} type="number" min="1" value={form.plazo_dias} onChange={e=>setForm({...form,plazo_dias:e.target.value})} />
                </div>
              </div>

              <div>
                <label style={S.label}>Notas (opcional)</label>
                <input style={S.input} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Observaciones..." />
              </div>

              {/* Preview */}
              {form.price > 0 && (
                <div style={{ ...S.card, background:'var(--s3)', fontSize:12, color:'var(--text2)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span>Total reserva</span><span style={{ fontFamily:'monospace', color:'var(--accent)' }}>{fmt(parseFloat(form.price)||0)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span>Abono inicial</span><span style={{ fontFamily:'monospace', color:'var(--green)' }}>−{fmt(parseFloat(form.abono)||0)}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, color:'var(--text)', borderTop:'1px solid var(--border)', paddingTop:6, marginTop:4 }}>
                    <span>Pendiente</span><span style={{ fontFamily:'monospace' }}>{fmt((parseFloat(form.price)||0)-(parseFloat(form.abono)||0))}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={S.btnOut}>Cancelar</button>
              <button onClick={createReservation} disabled={loading} style={S.btn('var(--accent)')}>📋 Crear reserva e imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* Abono Modal */}
      {abonoModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if(e.target===e.currentTarget) setAbonoModal(null) }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:360 }}>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>💰 Registrar Abono</h3>
            <p style={{ color:'var(--text2)', fontSize:12, marginBottom:16 }}>
              {abonoModal.product_emoji} {abonoModal.product_name} · {abonoModal.clients?.name}<br/>
              Pendiente: <b style={{ color:'var(--amber)' }}>{fmt(pendiente(abonoModal))}</b>
            </p>
            <label style={S.label}>Importe a abonar (€)</label>
            <input style={{ ...S.input, fontSize:22, fontWeight:700, textAlign:'center' as const, fontFamily:'monospace', padding:14, marginBottom:16 }}
              type="number" step="0.01" min="0" value={abonoImporte}
              onChange={e=>setAbonoImporte(e.target.value)} autoFocus placeholder="0.00" />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setAbonoModal(null)} style={{ ...S.btnOut, flex:1 }}>Cancelar</button>
              <button onClick={doAbono} disabled={loading} style={{ ...S.btn('var(--teal)'), flex:1 }}>💰 Registrar abono</button>
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
