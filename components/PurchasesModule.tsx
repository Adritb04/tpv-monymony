'use client'

import { useState, useEffect, useCallback } from 'react'
import { printPurchasePDF, printRebuPDF, printDepositPDF } from '@/lib/pdf-purchases'

const fmt  = (n: number) => (n || 0).toFixed(2).replace('.', ',') + ' €'
const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')

const S = {
  input:  { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 11px', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', width:'100%' },
  label:  { fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:4 },
  card:   { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px' },
  btn:    (c='var(--accent)') => ({ padding:'8px 14px', borderRadius:6, border:'none', background:c, color: c==='var(--amber)'?'#000':'#fff', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }),
  btnOut: { padding:'6px 10px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' },
  badge:  (color: string, bg: string) => ({ display:'inline-flex', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, color, background:bg }),
  modal:  { position:'fixed' as const, inset:0, background:'rgba(26,29,46,.6)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)' },
  mBox:   { background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:740, maxHeight:'92vh', overflowY:'auto' as const, boxShadow:'0 8px 32px rgba(89,122,166,.2)' },
  th:     { textAlign:'left' as const, fontSize:10, color:'var(--text2)', fontWeight:600, padding:'6px 10px', borderBottom:'1px solid var(--border)', textTransform:'uppercase' as const, letterSpacing:'.05em' },
  td:     { padding:'9px 10px', borderBottom:'1px solid var(--border)', fontSize:12, verticalAlign:'middle' as const },
}

type Tab = 'facturas' | 'rebu' | 'depositos'
type ItemMode = 'existente' | 'nuevo'
const STATUS_COLORS: Record<string, [string, string]> = {
  activo:     ['var(--green)',  'var(--green-dim)'],
  vendido:    ['var(--accent)', 'var(--accent-dim)'],
  recuperado: ['var(--teal)',   'var(--teal-dim)'],
  caducado:   ['var(--red)',    'var(--red-dim)'],
  cancelado:  ['var(--text3)', 'var(--s3)'],
}

interface PurchasesModuleProps { token: string; categories: any[] }

const emptyItem = () => ({ mode: 'nuevo' as ItemMode, product_id: null as number|null, name:'', emoji:'📦', category_id:'' as any, qty:1, unit_cost:0, sale_price:0, iva_rate:21, search:'' })

export default function PurchasesModule({ token, categories }: PurchasesModuleProps) {
  const [tab, setTab]           = useState<Tab>('facturas')
  const [purchases, setPurchases] = useState<any[]>([])
  const [rebuList, setRebuList] = useState<any[]>([])
  const [deposits, setDeposits] = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [toast, setToast]       = useState<{msg:string;ok:boolean}|null>(null)
  const [modal, setModal]       = useState<'factura'|'rebu'|'deposito'|'proveedores'|'status'|null>(null)
  const [statusTarget, setStatusTarget] = useState<any>(null)
  const [form, setForm]         = useState<any>({})
  const [items, setItems]       = useState<any[]>([emptyItem()])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supForm, setSupForm]   = useState<any>({})
  const [products, setProducts] = useState<any[]>([])

  const showToast = (msg: string, ok = true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      if (tab === 'facturas') { const r = await fetch('/api/purchases',{headers:{Authorization:`Bearer ${token}`}}); const j=await r.json(); setPurchases(j.data||[]) }
      else if (tab === 'rebu') { const r = await fetch('/api/rebu-purchases',{headers:{Authorization:`Bearer ${token}`}}); const j=await r.json(); setRebuList(j.data||[]) }
      else { const r = await fetch('/api/deposits',{headers:{Authorization:`Bearer ${token}`}}); const j=await r.json(); setDeposits(j.data||[]) }
    } catch { showToast('Error al cargar',false) } finally { setLoading(false) }
  }, [token, tab])

  useEffect(()=>{ load() },[load])
  useEffect(()=>{ try { const s=localStorage.getItem('tpv_suppliers'); if(s) setSuppliers(JSON.parse(s)) } catch {} },[])
  useEffect(()=>{ if(!token) return; fetch('/api/products',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(j=>setProducts(j.data||[])).catch(()=>{}) },[token])

  const saveSuppliers = (list: any[]) => { setSuppliers(list); localStorage.setItem('tpv_suppliers',JSON.stringify(list)) }
  const setF = (k: string, v: any) => setForm((p:any)=>({...p,[k]:v}))
  const setItem = (idx: number, k: string, v: any) => setItems(prev=>prev.map((it,i)=>i===idx?{...it,[k]:v}:it))

  const pickProduct = (idx: number, productId: string) => {
    if (!productId) { setItem(idx,'product_id',null); setItem(idx,'search',''); return }
    const p = products.find((x:any)=>String(x.id)===productId)
    if (!p) return
    setItems(prev=>prev.map((it,i)=>i===idx?{...it,mode:'existente',product_id:p.id,name:p.name,emoji:p.emoji,category_id:p.category_id||'',sale_price:parseFloat(p.price),iva_rate:p.iva_rate,search:p.name}:it))
  }

  const pickSupplier = (s: any) => { setF('supplier_name',s.name); setF('supplier_nif',s.nif); setF('supplier_phone',s.phone||''); setF('supplier_email',s.email||''); setF('supplier_address',s.address||'') }

  const saveFactura = async () => {
    if (!form.supplier_name||!form.supplier_nif||!form.supplier_invoice||!form.invoice_date||!form.invoice_total) return showToast('Completa todos los campos del proveedor',false)
    if (items.some(i=>!i.name||!i.sale_price)) return showToast('Todos los artículos necesitan nombre y precio',false)
    setLoading(true)
    try {
      const r = await fetch('/api/purchases',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...form,items})})
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      showToast(`✓ ${j.data.purchase.ref} — ${j.data.products.length} artículos`)
      printPurchasePDF(j.data.purchase,items)
      setModal(null); setForm({}); setItems([emptyItem()]); load()
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  const saveRebu = async () => {
    if (!form.seller_name||!form.seller_dni||!form.description||!form.buy_price||!form.sale_price) return showToast('Completa todos los campos obligatorios',false)
    setLoading(true)
    try {
      const r = await fetch('/api/rebu-purchases',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(form)})
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      showToast(`✓ ${j.data.purchase.ref} registrado`); printRebuPDF(j.data.purchase)
      setModal(null); setForm({}); load()
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  const saveDeposit = async () => {
    if (!form.client_name||!form.client_dni||!form.description||!form.agreed_price||!form.expiry_date) return showToast('Completa todos los campos obligatorios',false)
    setLoading(true)
    try {
      const r = await fetch('/api/deposits',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(form)})
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      showToast(`✓ ${j.data.deposit.ref} registrado`); printDepositPDF(j.data.deposit)
      setModal(null); setForm({}); load()
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  const updateStatus = async (status: string) => {
    if (!statusTarget) return
    try {
      const r = await fetch(`/api/deposits?id=${statusTarget.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({status})})
      if (!r.ok) throw new Error('Error')
      showToast('✓ Estado actualizado'); setStatusTarget(null); load()
    } catch(e:any){showToast(e.message,false)}
  }

  const sectionStyle = { background:'var(--s2)', borderRadius:8, padding:14, marginBottom:14, border:'1px solid var(--border)' }
  const sTitleStyle = (color='var(--amber)') => ({ fontSize:11, fontWeight:700, color, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:10 })

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>

      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8,flexShrink:0,flexWrap:'wrap' as const}}>
        <span style={{fontSize:16,fontWeight:700,marginRight:'auto'}}>🛒 Compras</span>
        <button onClick={()=>{setSupForm({});setModal('proveedores')}} style={{...S.btnOut,fontSize:11}}>🏢 Proveedores ({suppliers.length})</button>
        <button onClick={load} style={{...S.btnOut,fontSize:11}}>🔄</button>
        <button onClick={()=>{setForm({deposit_type:'deposito',commission_pct:20,entry_date:new Date().toISOString().slice(0,10)});setModal('deposito')}} style={S.btn('var(--teal)')}>+ Depósito</button>
        <button onClick={()=>{setForm({});setModal('rebu')}} style={S.btn('var(--teal)')}>+ REBU</button>
        <button onClick={()=>{setForm({invoice_date:new Date().toISOString().slice(0,10)});setItems([emptyItem()]);setModal('factura')}} style={S.btn('var(--amber)')}>+ Factura</button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,padding:'8px 20px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        {([['facturas','🧾 Facturas'],['rebu','♻️ REBU'],['depositos','🏷️ Depósitos']] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${tab===t?'var(--accent)':'var(--border)'}`,background:tab===t?'var(--accent-dim)':'none',color:tab===t?'var(--accent)':'var(--text2)',cursor:'pointer',fontSize:11,fontWeight:500,fontFamily:'inherit'}}>{l}</button>
        ))}
      </div>

      {/* Tables */}
      <div style={{flex:1,overflowY:'auto',padding:'12px 20px',minHeight:0}}>
        {tab==='facturas'&&(<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Ref','Proveedor','Nº Factura','Fecha','Total','PDF'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>
          {!purchases.length&&<tr><td colSpan={6} style={{textAlign:'center',color:'var(--text3)',padding:30}}>Sin facturas registradas</td></tr>}
          {purchases.map(p=>(
            <tr key={p.id} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <td style={S.td}><span style={{fontFamily:'monospace',fontWeight:600,color:'var(--amber)'}}>{p.ref}</span></td>
              <td style={{...S.td,fontWeight:600}}>{p.supplier_name}<div style={{fontSize:10,color:'var(--text2)'}}>{p.supplier_nif}</div></td>
              <td style={{...S.td,fontFamily:'monospace',fontSize:11}}>{p.supplier_invoice}</td>
              <td style={{...S.td,fontSize:11}}>{p.invoice_date}</td>
              <td style={{...S.td,fontFamily:'monospace',color:'var(--green)',fontWeight:700}}>{fmt(parseFloat(p.invoice_total))}</td>
              <td style={S.td}><button onClick={()=>printPurchasePDF(p,[])} style={{...S.btnOut,fontSize:10,color:'var(--amber)'}}>🖨️ PDF</button></td>
            </tr>
          ))}
        </tbody></table>)}

        {tab==='rebu'&&(<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Ref','Vendedor','DNI','Artículo','Compra','Venta prev.','Margen','PDF'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>
          {!rebuList.length&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text3)',padding:30}}>Sin compras REBU</td></tr>}
          {rebuList.map(r=>(
            <tr key={r.id} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <td style={S.td}><span style={{fontFamily:'monospace',fontWeight:600,color:'var(--teal)'}}>{r.ref}</span></td>
              <td style={{...S.td,fontWeight:600}}>{r.seller_name}</td>
              <td style={{...S.td,fontFamily:'monospace',fontSize:11}}>{r.seller_dni}</td>
              <td style={S.td}>{r.emoji} {r.description}</td>
              <td style={{...S.td,fontFamily:'monospace',color:'var(--red)'}}>{fmt(parseFloat(r.buy_price))}</td>
              <td style={{...S.td,fontFamily:'monospace',color:'var(--green)'}}>{fmt(parseFloat(r.sale_price))}</td>
              <td style={{...S.td,fontFamily:'monospace',color:'var(--amber)'}}>{fmt(parseFloat(r.sale_price)-parseFloat(r.buy_price))}</td>
              <td style={S.td}><button onClick={()=>printRebuPDF(r)} style={{...S.btnOut,fontSize:10,color:'var(--teal)'}}>🖨️ PDF</button></td>
            </tr>
          ))}
        </tbody></table>)}

        {tab==='depositos'&&(<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Ref','Tipo','Cliente','DNI','Artículo','Precio','Vence','Estado','Acciones'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>
          {!deposits.length&&<tr><td colSpan={9} style={{textAlign:'center',color:'var(--text3)',padding:30}}>Sin depósitos</td></tr>}
          {deposits.map(d=>{const[sc,sbg]=STATUS_COLORS[d.status]||STATUS_COLORS.cancelado;return(
            <tr key={d.id} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <td style={S.td}><span style={{fontFamily:'monospace',fontWeight:600,color:'var(--amber)'}}>{d.ref}</span></td>
              <td style={S.td}><span style={S.badge(d.deposit_type==='empeno'?'var(--red)':'var(--teal)',d.deposit_type==='empeno'?'var(--red-dim)':'var(--teal-dim)')}>{d.deposit_type==='empeno'?'Empeño':'Depósito'}</span></td>
              <td style={{...S.td,fontWeight:600}}>{d.client_name}</td>
              <td style={{...S.td,fontFamily:'monospace',fontSize:11}}>{d.client_dni}</td>
              <td style={S.td}>{d.description}</td>
              <td style={{...S.td,fontFamily:'monospace',color:'var(--green)'}}>{fmt(parseFloat(d.agreed_price))}</td>
              <td style={{...S.td,fontSize:11,color:d.status==='activo'?'var(--amber)':'var(--text3)'}}>{d.expiry_date}</td>
              <td style={S.td}><span style={S.badge(sc,sbg)}>{d.status}</span></td>
              <td style={S.td}>
                <button onClick={()=>printDepositPDF(d)} style={{...S.btnOut,fontSize:10,color:'var(--amber)',marginRight:4}}>🖨️</button>
                {d.status==='activo'&&<button onClick={()=>setStatusTarget(d)} style={{...S.btnOut,fontSize:10,color:'var(--accent)'}}>Estado</button>}
              </td>
            </tr>
          )})}
        </tbody></table>)}
      </div>

      {/* ══ MODAL PROVEEDORES ══ */}
      {modal==='proveedores'&&(
        <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div style={{...S.mBox,width:600}}>
            <div style={{display:'flex',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:16,fontWeight:700}}>🏢 Gestión de Proveedores</div>
              <button onClick={()=>setModal(null)} style={{...S.btnOut,marginLeft:'auto'}}>✕ Cerrar</button>
            </div>
            <div style={sectionStyle}>
              <div style={sTitleStyle()}>➕ {supForm.id?'Editar':'Nuevo'} proveedor</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div style={{gridColumn:'1/-1'}}><label style={S.label}>Nombre / Razón social *</label><input style={S.input} value={supForm.name||''} onChange={e=>setSupForm((p:any)=>({...p,name:e.target.value}))} placeholder="Distribuidor S.A." /></div>
                <div><label style={S.label}>NIF / CIF *</label><input style={S.input} value={supForm.nif||''} onChange={e=>setSupForm((p:any)=>({...p,nif:e.target.value}))} placeholder="B12345678" /></div>
                <div><label style={S.label}>Teléfono</label><input style={S.input} value={supForm.phone||''} onChange={e=>setSupForm((p:any)=>({...p,phone:e.target.value}))} /></div>
                <div><label style={S.label}>Email</label><input style={S.input} value={supForm.email||''} onChange={e=>setSupForm((p:any)=>({...p,email:e.target.value}))} /></div>
                <div><label style={S.label}>Dirección</label><input style={S.input} value={supForm.address||''} onChange={e=>setSupForm((p:any)=>({...p,address:e.target.value}))} /></div>
              </div>
              <div style={{marginTop:10,display:'flex',justifyContent:'flex-end',gap:8}}>
                {supForm.id&&<button onClick={()=>setSupForm({})} style={S.btnOut}>Cancelar</button>}
                <button onClick={()=>{
                  if(!supForm.name||!supForm.nif) return showToast('Nombre y NIF obligatorios',false)
                  const list=supForm.id?suppliers.map((s:any)=>s.id===supForm.id?supForm:s):[...suppliers,{...supForm,id:Date.now()}]
                  saveSuppliers(list); setSupForm({}); showToast('✓ Proveedor guardado')
                }} style={S.btn('var(--green)')}>💾 {supForm.id?'Actualizar':'Guardar'}</button>
              </div>
            </div>
            {suppliers.length>0?(
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',textTransform:'uppercase' as const,letterSpacing:'.05em',marginBottom:8}}>Proveedores guardados ({suppliers.length})</div>
                {suppliers.map((s:any)=>(
                  <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,background:'var(--s2)',marginBottom:6,border:'1px solid var(--border)'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>{s.name}</div>
                      <div style={{fontSize:11,color:'var(--text2)'}}>{s.nif}{s.phone?` · ${s.phone}`:''}{s.email?` · ${s.email}`:''}</div>
                    </div>
                    <button onClick={()=>{pickSupplier(s);setForm((p:any)=>({...p,invoice_date:new Date().toISOString().slice(0,10)}));setItems([emptyItem()]);setModal('factura')}} style={{...S.btn('var(--accent)'),fontSize:10,padding:'5px 10px'}}>Usar en factura</button>
                    <button onClick={()=>setSupForm({...s})} style={{...S.btnOut,fontSize:10}}>✏️</button>
                    <button onClick={()=>{if(confirm('¿Eliminar?'))saveSuppliers(suppliers.filter((x:any)=>x.id!==s.id))}} style={{...S.btnOut,fontSize:10,color:'var(--red)',borderColor:'var(--red-dim)'}}>✕</button>
                  </div>
                ))}
              </div>
            ):(
              <div style={{textAlign:'center',color:'var(--text3)',padding:20,fontSize:12}}>Aún no hay proveedores guardados</div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL FACTURA ══ */}
      {modal==='factura'&&(
        <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div style={S.mBox}>
            <div style={{display:'flex',alignItems:'center',marginBottom:18}}>
              <h3 style={{fontSize:17,fontWeight:700}}>🧾 Nueva Factura de Compra</h3>
              <button onClick={()=>setModal(null)} style={{...S.btnOut,marginLeft:'auto'}}>✕</button>
            </div>

            {/* PROVEEDOR */}
            <div style={sectionStyle}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={sTitleStyle()}>🏢 Proveedor</span>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {suppliers.length>0&&(
                    <select style={{...S.input,width:'auto',fontSize:11,cursor:'pointer'}} value="" onChange={e=>{if(e.target.value)pickSupplier(suppliers.find((s:any)=>String(s.id)===e.target.value))}}>
                      <option value="">📋 Cargar proveedor guardado...</option>
                      {suppliers.map((s:any)=><option key={s.id} value={s.id}>{s.name} — {s.nif}</option>)}
                    </select>
                  )}
                  <button onClick={()=>{setModal('proveedores');setSupForm({})}} style={{...S.btnOut,fontSize:10,color:'var(--green)',borderColor:'var(--green-dim)',whiteSpace:'nowrap' as const}}>+ Nuevo proveedor</button>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={S.label}>Nombre proveedor *</label><input style={S.input} value={form.supplier_name||''} onChange={e=>setF('supplier_name',e.target.value)} placeholder="Distribuidor S.A." /></div>
                <div><label style={S.label}>NIF / CIF *</label><input style={S.input} value={form.supplier_nif||''} onChange={e=>setF('supplier_nif',e.target.value)} placeholder="B12345678" /></div>
                <div><label style={S.label}>Nº factura *</label><input style={S.input} value={form.supplier_invoice||''} onChange={e=>setF('supplier_invoice',e.target.value)} placeholder="FAC-2026-001" /></div>
                <div><label style={S.label}>Fecha factura *</label><input style={S.input} type="date" value={form.invoice_date||''} onChange={e=>setF('invoice_date',e.target.value)} /></div>
                <div><label style={S.label}>Importe total (€) *</label><input style={S.input} type="number" step="0.01" value={form.invoice_total||''} onChange={e=>setF('invoice_total',parseFloat(e.target.value))} placeholder="0.00" /></div>
                <div><label style={S.label}>Observaciones</label><input style={S.input} value={form.notes||''} onChange={e=>setF('notes',e.target.value)} /></div>
              </div>
            </div>

            {/* ARTÍCULOS */}
            <div style={{marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--amber)',textTransform:'uppercase' as const,letterSpacing:'.05em'}}>📦 Artículos ({items.length})</span>
                <button onClick={()=>setItems(p=>[...p,emptyItem()])} style={{...S.btnOut,fontSize:11,color:'var(--green)',borderColor:'var(--green-dim)'}}>+ Añadir artículo</button>
              </div>

              {items.map((item,idx)=>(
                <div key={idx} style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:10}}>
                  {/* Mode */}
                  <div style={{display:'flex',gap:6,marginBottom:10,alignItems:'center'}}>
                    <span style={{fontSize:10,color:'var(--text2)',fontWeight:600,textTransform:'uppercase' as const}}>Tipo:</span>
                    {(['existente','nuevo'] as ItemMode[]).map(m=>(
                      <button key={m} type="button"
                        onClick={()=>setItems(prev=>prev.map((it,i)=>i===idx?{...it,mode:m,product_id:null,name:'',search:''}:it))}
                        style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${item.mode===m?'var(--accent)':'var(--border)'}`,background:item.mode===m?'var(--accent-dim)':'none',color:item.mode===m?'var(--accent)':'var(--text2)',cursor:'pointer',fontSize:11,fontWeight:item.mode===m?600:400,fontFamily:'inherit'}}>
                        {m==='existente'?'📦 Producto existente':'➕ Artículo nuevo'}
                      </button>
                    ))}
                    {items.length>1&&<button onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))} style={{...S.btnOut,color:'var(--red)',borderColor:'var(--red-dim)',fontSize:11,marginLeft:'auto'}}>✕ Quitar</button>}
                  </div>

                  {/* Search existing */}
                  {item.mode==='existente'&&(
                    <div style={{marginBottom:10}}>
                      <label style={S.label}>Buscar en catálogo</label>
                      <div style={{position:'relative'}}>
                        <input style={{...S.input,paddingRight:30}} value={item.search||''} onChange={e=>setItem(idx,'search',e.target.value)} placeholder="Escribe nombre o código de barras..." />
                        {item.search&&!item.product_id&&(
                          <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:10,background:'var(--s1)',border:'1px solid var(--border)',borderRadius:6,boxShadow:'0 4px 16px rgba(0,0,0,.1)',maxHeight:200,overflowY:'auto' as const}}>
                            {products.filter(p=>p.active&&(p.name.toLowerCase().includes(item.search.toLowerCase())||(p.barcode&&p.barcode.includes(item.search)))).slice(0,8).map((p:any)=>(
                              <div key={p.id} onClick={()=>pickProduct(idx,String(p.id))}
                                style={{padding:'8px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid var(--border)'}}
                                onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                                <span style={{fontSize:18}}>{p.emoji}</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,fontWeight:600}}>{p.name}</div>
                                  <div style={{fontSize:10,color:'var(--text2)'}}>{fmt(parseFloat(p.price))} · IVA {p.iva_rate}%{p.barcode?` · 🔢 ${p.barcode}`:''}</div>
                                </div>
                                <span style={{fontSize:10,color:'var(--text3)'}}>Stock: {p.stock}</span>
                              </div>
                            ))}
                            {products.filter(p=>p.active&&p.name.toLowerCase().includes(item.search.toLowerCase())).length===0&&(
                              <div style={{padding:'10px 12px',fontSize:11,color:'var(--text3)'}}>Sin resultados</div>
                            )}
                          </div>
                        )}
                      </div>
                      {item.product_id&&(
                        <div style={{marginTop:6,padding:'6px 10px',background:'var(--green-dim)',borderRadius:6,fontSize:11,color:'var(--green)',display:'flex',alignItems:'center',gap:6}}>
                          ✓ {item.emoji} <b>{item.name}</b> seleccionado
                          <button onClick={()=>setItems(prev=>prev.map((it,i)=>i===idx?{...it,product_id:null,search:'',name:''}:it))} style={{background:'none',border:'none',color:'var(--green)',cursor:'pointer',marginLeft:'auto',fontSize:14}}>✕</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* New product fields */}
                  {item.mode==='nuevo'&&(
                    <div style={{display:'grid',gridTemplateColumns:'70px 1fr 1fr',gap:8,marginBottom:8}}>
                      <div><label style={S.label}>Emoji</label><input style={S.input} value={item.emoji} onChange={e=>setItem(idx,'emoji',e.target.value)} maxLength={4} /></div>
                      <div style={{gridColumn:'2/-1'}}><label style={S.label}>Nombre *</label><input style={S.input} value={item.name} onChange={e=>setItem(idx,'name',e.target.value)} placeholder="Nombre del producto" /></div>
                      <div><label style={S.label}>Categoría</label>
                        <select style={S.input} value={item.category_id} onChange={e=>setItem(idx,'category_id',parseInt(e.target.value))}>
                          <option value="">Sin categoría</option>
                          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Shared fields */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    <div><label style={S.label}>Unidades *</label><input style={S.input} type="number" min="1" value={item.qty} onChange={e=>setItem(idx,'qty',parseInt(e.target.value)||1)} /></div>
                    <div><label style={S.label}>Coste unit. (€)</label><input style={S.input} type="number" step="0.01" min="0" value={item.unit_cost||''} onChange={e=>setItem(idx,'unit_cost',parseFloat(e.target.value)||0)} placeholder="0.00" /></div>
                    <div><label style={S.label}>P. Venta (€) *</label><input style={S.input} type="number" step="0.01" min="0" value={item.sale_price||''} onChange={e=>setItem(idx,'sale_price',parseFloat(e.target.value)||0)} placeholder="0.00" /></div>
                    <div><label style={S.label}>IVA %</label>
                      <select style={S.input} value={item.iva_rate} onChange={e=>setItem(idx,'iva_rate',parseInt(e.target.value))}>
                        <option value={4}>4%</option><option value={10}>10%</option><option value={21}>21%</option>
                      </select>
                    </div>
                  </div>
                  {item.unit_cost>0&&item.sale_price>0&&(
                    <div style={{marginTop:6,fontSize:10,color:'var(--text2)',background:'var(--s3)',padding:'5px 8px',borderRadius:4}}>
                      Margen: <b style={{color:'var(--green)'}}>{fmtN(item.sale_price-item.unit_cost)} €</b> · {((item.sale_price-item.unit_cost)/item.unit_cost*100).toFixed(1)}% · Total coste lote: <b>{fmtN(item.unit_cost*item.qty)} €</b>
                    </div>
                  )}
                </div>
              ))}

              {items.some(i=>i.sale_price>0)&&(
                <div style={{background:'var(--s2)',borderRadius:8,padding:'10px 14px',display:'flex',gap:20,fontSize:11}}>
                  <span>Artículos: <b>{items.reduce((a,i)=>a+(i.qty||0),0)}</b></span>
                  <span>Coste total: <b style={{color:'var(--red)'}}>{fmtN(items.reduce((a,i)=>a+(i.unit_cost||0)*(i.qty||1),0))} €</b></span>
                  <span>Venta total: <b style={{color:'var(--green)'}}>{fmtN(items.reduce((a,i)=>a+(i.sale_price||0)*(i.qty||1),0))} €</b></span>
                </div>
              )}
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(null)} style={S.btnOut}>Cancelar</button>
              <button onClick={saveFactura} disabled={loading} style={S.btn('var(--amber)')}>{loading?'...':'💾 Registrar y generar PDF'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL REBU ══ */}
      {modal==='rebu'&&(
        <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div style={S.mBox}>
            <div style={{display:'flex',alignItems:'center',marginBottom:18}}>
              <h3 style={{fontSize:17,fontWeight:700}}>♻️ Registrar Compra REBU</h3>
              <button onClick={()=>setModal(null)} style={{...S.btnOut,marginLeft:'auto'}}>✕</button>
            </div>
            <p style={{color:'var(--text2)',fontSize:11,marginBottom:16}}>Compra a particular — DNI obligatorio (Art. 135-139 LIVA)</p>
            <div style={sectionStyle}>
              <div style={sTitleStyle('var(--teal)')}>👤 Vendedor (particular)</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={S.label}>Nombre completo *</label><input style={S.input} value={form.seller_name||''} onChange={e=>setF('seller_name',e.target.value)} /></div>
                <div><label style={S.label}>DNI / NIE *</label><input style={S.input} value={form.seller_dni||''} onChange={e=>setF('seller_dni',e.target.value)} placeholder="12345678A" /></div>
                <div><label style={S.label}>Teléfono</label><input style={S.input} value={form.seller_phone||''} onChange={e=>setF('seller_phone',e.target.value)} /></div>
                <div><label style={S.label}>Dirección</label><input style={S.input} value={form.seller_address||''} onChange={e=>setF('seller_address',e.target.value)} /></div>
              </div>
            </div>
            <div style={sectionStyle}>
              <div style={sTitleStyle('var(--teal)')}>📦 Artículo</div>
              <div style={{display:'grid',gridTemplateColumns:'70px 1fr 1fr',gap:10}}>
                <div><label style={S.label}>Emoji</label><input style={S.input} value={form.emoji||'♻️'} onChange={e=>setF('emoji',e.target.value)} maxLength={4} /></div>
                <div style={{gridColumn:'2/-1'}}><label style={S.label}>Descripción *</label><input style={S.input} value={form.description||''} onChange={e=>setF('description',e.target.value)} placeholder="Ej: iPhone 12 64GB negro" /></div>
                <div><label style={S.label}>Categoría</label><select style={S.input} value={form.category_id||''} onChange={e=>setF('category_id',parseInt(e.target.value))}><option value="">Sin categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
                <div><label style={S.label}>Precio compra (€) *</label><input style={S.input} type="number" step="0.01" min="0" value={form.buy_price||''} onChange={e=>setF('buy_price',parseFloat(e.target.value))} /></div>
                <div><label style={S.label}>Precio venta prev. (€) *</label><input style={S.input} type="number" step="0.01" min="0" value={form.sale_price||''} onChange={e=>setF('sale_price',parseFloat(e.target.value))} /></div>
              </div>
              {form.buy_price>0&&form.sale_price>0&&(<div style={{marginTop:8,fontSize:11,color:'var(--text2)',background:'var(--s3)',padding:'6px 10px',borderRadius:6}}>Margen: <b style={{color:'var(--green)'}}>{fmtN(form.sale_price-form.buy_price)} €</b> · IVA s/margen: <b style={{color:'var(--amber)'}}>{fmtN((form.sale_price-form.buy_price)*21/121)} €</b></div>)}
            </div>
            <div style={{marginBottom:14}}><label style={S.label}>Observaciones</label><input style={S.input} value={form.notes||''} onChange={e=>setF('notes',e.target.value)} /></div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(null)} style={S.btnOut}>Cancelar</button>
              <button onClick={saveRebu} disabled={loading} style={S.btn('var(--teal)')}>{loading?'...':'💾 Registrar y generar PDF'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DEPÓSITO ══ */}
      {modal==='deposito'&&(
        <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div style={S.mBox}>
            <div style={{display:'flex',alignItems:'center',marginBottom:18}}>
              <h3 style={{fontSize:17,fontWeight:700}}>🏷️ Depósito / Empeño</h3>
              <button onClick={()=>setModal(null)} style={{...S.btnOut,marginLeft:'auto'}}>✕</button>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              {[['deposito','📦 Depósito en venta','El cliente deja el artículo, cobra si se vende'],['empeno','🏷️ Empeño','El cliente deja el artículo a cambio de un préstamo']].map(([type,label,desc])=>(
                <div key={type} onClick={()=>setF('deposit_type',type)} style={{flex:1,padding:12,borderRadius:8,border:`2px solid ${form.deposit_type===type?'var(--amber)':'var(--border)'}`,background:form.deposit_type===type?'var(--amber-dim)':'var(--s2)',cursor:'pointer'}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:4,color:form.deposit_type===type?'var(--amber)':'var(--text)'}}>{label}</div>
                  <div style={{fontSize:11,color:'var(--text2)'}}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={sectionStyle}>
              <div style={sTitleStyle('var(--amber)')}>👤 Cliente</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><label style={S.label}>Nombre completo *</label><input style={S.input} value={form.client_name||''} onChange={e=>setF('client_name',e.target.value)} /></div>
                <div><label style={S.label}>DNI / NIE *</label><input style={S.input} value={form.client_dni||''} onChange={e=>setF('client_dni',e.target.value)} placeholder="12345678A" /></div>
                <div><label style={S.label}>Teléfono</label><input style={S.input} value={form.client_phone||''} onChange={e=>setF('client_phone',e.target.value)} /></div>
                <div><label style={S.label}>Dirección</label><input style={S.input} value={form.client_address||''} onChange={e=>setF('client_address',e.target.value)} /></div>
              </div>
            </div>
            <div style={sectionStyle}>
              <div style={sTitleStyle('var(--amber)')}>📦 Artículo y condiciones</div>
              <div style={{display:'grid',gridTemplateColumns:'70px 1fr 1fr',gap:10}}>
                <div><label style={S.label}>Emoji</label><input style={S.input} value={form.emoji||'📦'} onChange={e=>setF('emoji',e.target.value)} maxLength={4} /></div>
                <div style={{gridColumn:'2/-1'}}><label style={S.label}>Descripción *</label><input style={S.input} value={form.description||''} onChange={e=>setF('description',e.target.value)} placeholder="Ej: Reloj Casio dorado" /></div>
                <div><label style={S.label}>Categoría</label><select style={S.input} value={form.category_id||''} onChange={e=>setF('category_id',parseInt(e.target.value))}><option value="">Sin categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
                <div><label style={S.label}>Valor tasado (€)</label><input style={S.input} type="number" step="0.01" min="0" value={form.appraised_value||''} onChange={e=>setF('appraised_value',parseFloat(e.target.value))} /></div>
                <div><label style={S.label}>{form.deposit_type==='empeno'?'Importe prestado (€) *':'Precio acordado (€) *'}</label><input style={S.input} type="number" step="0.01" min="0" value={form.agreed_price||''} onChange={e=>setF('agreed_price',parseFloat(e.target.value))} /></div>
                <div><label style={S.label}>Comisión tienda (%)</label><input style={S.input} type="number" step="0.5" min="0" max="100" value={form.commission_pct||20} onChange={e=>setF('commission_pct',parseFloat(e.target.value))} /></div>
                <div><label style={S.label}>Fecha entrada</label><input style={S.input} type="date" value={form.entry_date||new Date().toISOString().slice(0,10)} onChange={e=>setF('entry_date',e.target.value)} /></div>
                <div><label style={S.label}>Fecha límite *</label><input style={S.input} type="date" value={form.expiry_date||''} onChange={e=>setF('expiry_date',e.target.value)} /></div>
              </div>
              {form.agreed_price>0&&form.commission_pct>0&&(<div style={{marginTop:8,fontSize:11,color:'var(--text2)',background:'var(--s3)',padding:'6px 10px',borderRadius:6}}>
                Comisión tienda: <b style={{color:'var(--amber)'}}>{fmtN(form.agreed_price*form.commission_pct/100)} €</b> · Cliente {form.deposit_type==='empeno'?'recoge':'recibe'}: <b style={{color:'var(--green)'}}>{fmtN(form.agreed_price*(1-form.commission_pct/100))} €</b>
              </div>)}
            </div>
            <div style={{marginBottom:14}}><label style={S.label}>Observaciones / Condiciones adicionales</label><input style={S.input} value={form.notes||''} onChange={e=>setF('notes',e.target.value)} /></div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(null)} style={S.btnOut}>Cancelar</button>
              <button onClick={saveDeposit} disabled={loading} style={S.btn('var(--amber)')}>{loading?'...':'💾 Registrar y generar PDF'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS MODAL ── */}
      {statusTarget&&(
        <div style={S.modal} onClick={e=>{if(e.target===e.currentTarget)setStatusTarget(null)}}>
          <div style={{...S.mBox,width:380,textAlign:'center' as const}}>
            <div style={{fontSize:36,marginBottom:8}}>🔄</div>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:4}}>Cambiar estado</h3>
            <p style={{color:'var(--text2)',fontSize:11,marginBottom:20}}>{statusTarget.ref} · {statusTarget.client_name}</p>
            <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
              {[['vendido','✅ Vendido','El artículo ha sido vendido','var(--green)'],['recuperado','↩️ Recuperado','El cliente ha recogido el artículo','var(--teal)'],['caducado','⏰ Caducado','Ha vencido el plazo','var(--amber)'],['cancelado','❌ Cancelado','Cancelado por acuerdo','var(--red)']].map(([status,label,desc,color])=>(
                <button key={status} onClick={()=>updateStatus(status)} style={{padding:'10px 16px',borderRadius:8,border:`1px solid ${color}`,background:'none',color,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600,textAlign:'left' as const}}>
                  {label} <span style={{fontSize:11,fontWeight:400,color:'var(--text2)',marginLeft:8}}>{desc}</span>
                </button>
              ))}
            </div>
            <button onClick={()=>setStatusTarget(null)} style={{...S.btnOut,width:'100%',marginTop:12}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast&&<div style={{position:'fixed',bottom:24,right:24,background:toast.ok?'var(--green)':'var(--red)',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:13,fontWeight:600,zIndex:999,boxShadow:'0 8px 32px rgba(0,0,0,.2)'}}>{toast.msg}</div>}
    </div>
  )
}
