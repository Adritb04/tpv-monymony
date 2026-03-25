'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { printPurchasePDF, printRebuPDF, printDepositPDF } from '@/lib/pdf-purchases'

const fmt  = (n: number) => (n || 0).toFixed(2).replace('.', ',') + ' €'
const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')

const C = {
  bg:'#f5f7fb', s1:'#ffffff', s2:'#eef1f7', s3:'#e4e8f2',
  border:'#d9deea', accent:'#ce1317', green:'#3ecf8e',
  red:'#ce1317', amber:'#f59f00', teal:'#20c997',
  text:'#1a1d2e', text2:'#5c6a8a', text3:'#9caac6',
}

type MobileTab = 'tpv' | 'historial' | 'stock' | 'nuevo'
type NuevoSub = 'menu' | 'producto' | 'factura' | 'rebu' | 'deposito'

interface MobileTPVProps { token: string; user: any; onLogout: () => void }

function buildTicketHTML(s: any): string {
  const isRect = s.type === 'rectificativo'
  const bd = s.iva_breakdown || {}
  const fmtN2 = (n: number) => (n || 0).toFixed(2).replace('.', ',')
  let ivaLines = ''
  ;[4, 10, 21].forEach(r => {
    const g = bd[String(r)]
    if (g?.base > 0) ivaLines +=
      `<div style="display:flex;justify-content:space-between;font-size:11px;color:#555"><span>Base IVA ${r}%</span><span>${fmtN2(g.base)} €</span></div>` +
      `<div style="display:flex;justify-content:space-between;font-size:11px;color:#555"><span>Cuota IVA ${r}%</span><span>${fmtN2(g.iva)} €</span></div>`
  })
  const rebu = bd.rebu
  const rebuNote = rebu?.total > 0 ? `<div style="font-size:10px;color:#999">REBU — IVA s/margen incl.</div>` : ''
  const items = (s.items || []).map((i: any) =>
    `<div style="display:flex;justify-content:space-between;font-size:12px"><span>${i.emoji||''} ${i.name} x${i.qty}</span><span>${fmtN2(i.line_total || i.price * i.qty)} €</span></div>` +
    `<div style="font-size:10px;color:#999;padding-left:6px">${i.regime==='rebu'?'REBU':'IVA '+i.iva_rate+'%'}</div>`
  ).join('')
  return `<div style="font-family:'Courier New',monospace;font-size:12px;color:#000;max-width:320px;margin:0 auto">
  <div style="text-align:center;font-weight:700;font-size:14px">${s.razon_social||''}</div>
  <div style="text-align:center;font-size:11px">NIF: ${s.nif||''}</div>
  <div style="border-top:1px dashed #999;margin:5px 0"></div>
  ${isRect?`<div style="text-align:center;color:red;font-weight:700">⚠️ FACTURA RECTIFICATIVA</div><div style="border-top:1px dashed #999;margin:5px 0"></div>`:''}
  <div style="display:flex;justify-content:space-between;font-size:11px"><span>Ticket</span><span>${s.ticket_id}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:11px"><span>Fecha</span><span>${s.date} ${s.time}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:11px"><span>Cajero</span><span>${s.cashier_name}</span></div>
  <div style="border-top:1px dashed #999;margin:5px 0"></div>
  ${items}
  <div style="border-top:1px dashed #999;margin:5px 0"></div>
  ${ivaLines}${rebuNote}
  ${ivaLines||rebuNote?'<div style="border-top:1px dashed #999;margin:5px 0"></div>':''}
  <div style="display:flex;justify-content:space-between;font-size:11px"><span>Base imponible</span><span>${fmtN2(Math.abs(s.base))} €</span></div>
  <div style="display:flex;justify-content:space-between;font-size:11px"><span>IVA total</span><span>${fmtN2(Math.abs(s.iva_total))} €</span></div>
  <div style="border-top:2px solid #000;margin:5px 0"></div>
  <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:${isRect?'red':'#000'}">
    <span>TOTAL${isRect?' RECTIFICADO':''}</span><span>${isRect?'−':''}${fmtN2(Math.abs(s.total))} €</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:11px"><span>Pago</span><span>${s.pay==='efectivo'?'Efectivo':'Tarjeta'}</span></div>
  <div style="text-align:center;margin-top:6px;font-size:11px">*** Gracias por su compra ***</div>
  <div style="height:10mm"></div>
</div>`
}

function printMobileTicket(s: any) {
  const w = window.open('', '_blank', 'width=400,height=700')!
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket ${s.ticket_id}</title>
  <style>body{margin:10px;background:#fff}@page{size:80mm auto;margin:0}@media print{body{margin:0}}</style></head>
  <body>${buildTicketHTML(s)}</body></html>`)
  w.document.close()
  setTimeout(() => { w.print(); w.close() }, 400)
}

export default function MobileTPV({ token, user, onLogout }: MobileTPVProps) {
  const [tab, setTab]               = useState<MobileTab>(() => user.role === 'cajero' ? 'tpv' : 'historial')
  const [nuevoSub, setNuevoSub]     = useState<NuevoSub>('menu')
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [sales, setSales]           = useState<any[]>([])
  const [cart, setCart]             = useState<any[]>([])
  const [payMethod, setPayMethod]   = useState<'efectivo'|'tarjeta'>('efectivo')
  const [search, setSearch]         = useState('')
  const [activeCat, setActiveCat]   = useState(0)
  const [loading, setLoading]       = useState(false)
  const [toast, setToast]           = useState<{msg:string;ok:boolean}|null>(null)
  const [ticketModal, setTicketModal] = useState<any>(null)
  const [cartOpen, setCartOpen]     = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [histTab, setHistTab]       = useState<'ventas'|'caja'|'compras'|'reservas'>('ventas')
  const [cajaList, setCajaList]     = useState<any[]>([])
  const [comprasList, setComprasList] = useState<any[]>([])
  const [rebuList, setRebuList]     = useState<any[]>([])
  const [reservasList, setReservasList] = useState<any[]>([])

  // Forms
  const [prdForm, setPrdForm]       = useState<any>({ emoji:'📦', regime:'iva', iva_rate:21, stock:1, price:0, cost_price:0 })
  const [facForm, setFacForm]       = useState<any>({})
  const [facItems, setFacItems]     = useState<any[]>([{ name:'', emoji:'📦', category_id:'', qty:1, unit_cost:0, sale_price:0, iva_rate:21 }])
  const [rebuForm, setRebuForm]     = useState<any>({ emoji:'♻️' })
  const [depForm, setDepForm]       = useState<any>({ deposit_type:'deposito', commission_pct:20, emoji:'📦' })

  const showToast = (msg: string, ok = true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  const loadData = useCallback(async () => {
    try {
      const [pr, ca] = await Promise.all([api.products.list(token), api.categories.list(token)])
      setProducts(pr.data||[]); setCategories(ca.data||[])
    } catch(e:any) { showToast(e.message,false) }
  }, [token])

  const loadSales = useCallback(async () => {
    try { const r = await api.sales.list(token,{limit:'50'}); setSales(r.data||[]) }
    catch(e:any) { showToast(e.message,false) }
  }, [token])

  const loadHistTab = useCallback(async (ht: string) => {
    try {
      if (ht === 'ventas') { const r = await api.sales.list(token,{limit:'50'}); setSales(r.data||[]) }
      if (ht === 'caja') {
        const r = await fetch('/api/cash-register?limit=20', { headers:{ Authorization:`Bearer ${token}` } })
        const j = await r.json(); setCajaList(j.data||[])
      }
      if (ht === 'compras') {
        const [r1, r2] = await Promise.all([
          fetch('/api/purchases?limit=30', { headers:{ Authorization:`Bearer ${token}` } }),
          fetch('/api/rebu-purchases?limit=30', { headers:{ Authorization:`Bearer ${token}` } }),
        ])
        const j1 = await r1.json(); const j2 = await r2.json()
        setComprasList(j1.data||[]); setRebuList(j2.data||[])
      }
      if (ht === 'reservas') {
        const r = await fetch('/api/reservations?status=activa', { headers:{ Authorization:`Bearer ${token}` } })
        const j = await r.json(); setReservasList(j.data||[])
      }
    } catch(e:any) { showToast(e.message,false) }
  }, [token])

  useEffect(()=>{ loadData() },[loadData])
  useEffect(()=>{ if(tab==='historial') loadHistTab(histTab) },[tab,histTab,loadHistTab])

  // ── Cart ──
  const addToCart = (p:any) => {
    if(!p.active||p.stock===0) return
    setCart(prev=>{
      const ex=prev.find(i=>i.id===p.id)
      if(ex) return ex.qty>=p.stock?prev:prev.map(i=>i.id===p.id?{...i,qty:i.qty+1}:i)
      return [...prev,{id:p.id,name:p.name,emoji:p.emoji,price:parseFloat(p.price),iva_rate:p.iva_rate,regime:p.regime,cost_price:parseFloat(p.cost_price||0),qty:1}]
    })
  }
  const chgQty = (id:number,d:number) => setCart(prev=>prev.map(i=>i.id===id?{...i,qty:i.qty+d}:i).filter(i=>i.qty>0))
  const cartTotal = cart.reduce((a,i)=>a+i.price*i.qty,0)
  const cartCount = cart.reduce((a,i)=>a+i.qty,0)

  const checkout = async () => {
    if(!cart.length) return
    setLoading(true)
    try {
      const items = cart.map(i=>{
        const lt=i.price*i.qty
        const lb=i.regime==='rebu'?lt-Math.max(0,i.price-i.cost_price)*i.qty*i.iva_rate/(100+i.iva_rate):lt/(1+i.iva_rate/100)
        return{product_id:i.id,name:i.name,emoji:i.emoji,price:i.price,qty:i.qty,regime:i.regime,iva_rate:i.iva_rate,cost_price:i.cost_price,line_total:lt,line_base:lb,line_iva:lt-lb}
      })
      const res = await api.sales.create(token,{items,pay:payMethod})
      setCart([]); setCartOpen(false); loadData(); setTicketModal(res.data); showToast('✓ Venta registrada')
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  // ── Save producto simple ──
  const savePrd = async () => {
    if(!prdForm.name) return showToast('El nombre es obligatorio',false)
    setLoading(true)
    try {
      await api.products.create(token,prdForm)
      showToast('✓ Producto creado')
      setPrdForm({emoji:'📦',regime:'iva',iva_rate:21,stock:1,price:0,cost_price:0})
      loadData(); setNuevoSub('menu')
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  // ── Save factura ──
  const saveFactura = async () => {
    if(!facForm.supplier_name||!facForm.supplier_nif||!facForm.supplier_invoice||!facForm.invoice_date||!facForm.invoice_total)
      return showToast('Completa los datos del proveedor',false)
    if(facItems.some(i=>!i.name||!i.sale_price)) return showToast('Todos los artículos necesitan nombre y precio',false)
    setLoading(true)
    try {
      const res = await fetch('/api/purchases',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...facForm,items:facItems})})
      const j = await res.json()
      if(!res.ok) throw new Error(j.error)
      showToast(`✓ ${j.data.purchase.ref} — ${j.data.products.length} artículos creados`)
      printPurchasePDF(j.data.purchase,facItems)
      setFacForm({}); setFacItems([{name:'',emoji:'📦',category_id:'',qty:1,unit_cost:0,sale_price:0,iva_rate:21}])
      loadData(); setNuevoSub('menu')
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  // ── Save REBU ──
  const saveRebu = async () => {
    if(!rebuForm.seller_name||!rebuForm.seller_dni||!rebuForm.description||!rebuForm.buy_price||!rebuForm.sale_price)
      return showToast('Completa todos los campos obligatorios',false)
    setLoading(true)
    try {
      const res = await fetch('/api/rebu-purchases',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(rebuForm)})
      const j = await res.json()
      if(!res.ok) throw new Error(j.error)
      showToast(`✓ ${j.data.purchase.ref} registrado`)
      printRebuPDF(j.data.purchase)
      setRebuForm({emoji:'♻️'}); loadData(); setNuevoSub('menu')
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  // ── Save depósito/empeño ──
  const saveDeposito = async () => {
    if(!depForm.client_name||!depForm.client_dni||!depForm.description||!depForm.agreed_price||!depForm.expiry_date)
      return showToast('Completa todos los campos obligatorios',false)
    setLoading(true)
    try {
      const res = await fetch('/api/deposits',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(depForm)})
      const j = await res.json()
      if(!res.ok) throw new Error(j.error)
      showToast(`✓ ${j.data.deposit.ref} registrado`)
      printDepositPDF(j.data.deposit)
      setDepForm({deposit_type:'deposito',commission_pct:20,emoji:'📦'}); loadData(); setNuevoSub('menu')
    } catch(e:any){showToast(e.message,false)} finally{setLoading(false)}
  }

  const setP  = (k:string,v:any) => setPrdForm((p:any)=>({...p,[k]:v}))
  const setFac = (k:string,v:any) => setFacForm((p:any)=>({...p,[k]:v}))
  const setReb = (k:string,v:any) => setRebuForm((p:any)=>({...p,[k]:v}))
  const setDep = (k:string,v:any) => setDepForm((p:any)=>({...p,[k]:v}))
  const setFacItem = (i:number,k:string,v:any) => setFacItems(prev=>prev.map((item,idx)=>idx===i?{...item,[k]:v}:item))

  const filteredPrds = products.filter(p=>p.active&&(activeCat===0||p.category_id===activeCat)&&(!search||p.name.toLowerCase().includes(search.toLowerCase())))
  const filteredStock = products.filter(p=>!stockSearch||p.name.toLowerCase().includes(stockSearch.toLowerCase()))

  const inp = {background:C.s2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',color:C.text,fontFamily:'inherit',fontSize:14,outline:'none',width:'100%'} as const
  const btn = (bg=C.accent,color='#fff')=>({padding:'12px 16px',borderRadius:10,border:'none',background:bg,color,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit',width:'100%'}) as const
  const lbl = {fontSize:10,color:C.text2,fontWeight:600,textTransform:'uppercase' as const,display:'block',marginBottom:4}

  return (
    <div style={{background:C.bg,height:'100vh',display:'flex',flexDirection:'column' as const,color:C.text,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
    <div style={{flex:1,overflowY:'auto',paddingBottom:80}}>

      {/* TOP BAR */}
      <div style={{position:'sticky',top:0,zIndex:50,background:C.s1,borderBottom:`1px solid ${C.border}`,padding:'10px 14px',display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontWeight:700,fontSize:15,color:C.accent}}>🏪 TPV</span>
        <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:'rgba(62,207,142,.12)',color:C.green,fontWeight:600}}>✓ Legal</span>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:11,color:C.text2}}>{user.name}</span>
          {tab==='tpv'&&cart.length>0&&(
            <button onClick={()=>setCartOpen(true)} style={{background:C.accent,border:'none',borderRadius:20,padding:'5px 12px',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700}}>
              🛒 {cartCount} · {fmt(cartTotal)}
            </button>
          )}
          <button onClick={onLogout} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 8px',color:C.text2,cursor:'pointer',fontSize:11}}>Salir</button>
        </div>
      </div>

      {/* TPV TAB */}
      {tab==='tpv'&&(
        <div style={{padding:'10px 12px'}}>
          <input style={{...inp,marginBottom:10}} placeholder="🔍 Buscar producto..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:10,paddingBottom:4}}>
            {[{id:0,name:'Todos',icon:'🛍️'},...categories].map(c=>(
              <button key={c.id} onClick={()=>setActiveCat(c.id)} style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${activeCat===c.id?C.accent:C.border}`,background:activeCat===c.id?C.accent:'none',color:activeCat===c.id?'#fff':C.text2,cursor:'pointer',whiteSpace:'nowrap' as const,fontSize:12,fontWeight:500,fontFamily:'inherit',flexShrink:0}}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {filteredPrds.map(p=>(
              <div key={p.id} onClick={()=>addToCart(p)} style={{background:C.s2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:'10px 8px',textAlign:'center' as const,cursor:p.stock>0?'pointer':'not-allowed',opacity:p.stock===0?.4:1}}>
                <div style={{fontSize:24,marginBottom:4}}>{p.emoji}</div>
                <div style={{fontSize:10,fontWeight:600,marginBottom:3,lineHeight:1.3}}>{p.name}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.accent,fontFamily:'monospace'}}>{fmt(parseFloat(p.price))}</div>
                <div style={{fontSize:9,color:p.stock<5?C.amber:C.text3,marginTop:2}}>Stock: {p.stock}</div>
              </div>
            ))}
            {!filteredPrds.length&&<div style={{gridColumn:'1/-1',textAlign:'center' as const,color:C.text3,padding:30}}>Sin productos</div>}
          </div>
        </div>
      )}

      {/* HISTORIAL TAB */}
      {tab==='historial'&&(
        <div>
          {/* Sub-tabs */}
          <div style={{display:'flex',overflowX:'auto',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            {([['ventas','🧾','Ventas'],['caja','💰','Caja'],['compras','📦','Compras'],['reservas','📋','Reservas']] as [typeof histTab,string,string][]).map(([ht,icon,label])=>(
              <button key={ht} onClick={()=>setHistTab(ht)} style={{
                flex:1,padding:'10px 4px',border:'none',borderBottom:`2px solid ${histTab===ht?C.accent:'transparent'}`,
                background:'none',color:histTab===ht?C.accent:C.text2,cursor:'pointer',fontSize:11,fontWeight:histTab===ht?700:400,fontFamily:'inherit',whiteSpace:'nowrap' as const
              }}>{icon} {label}</button>
            ))}
          </div>

          <div style={{padding:'10px 12px'}}>

            {/* ── VENTAS ── */}
            {histTab==='ventas'&&(()=>{
              const ventas = sales.filter(s=>s.type!=='rectificativo')
              const rects  = sales.filter(s=>s.type==='rectificativo')
              const totalEfectivo = ventas.filter(s=>s.pay==='efectivo').reduce((a,b)=>a+parseFloat(b.total),0)
              const totalTarjeta  = ventas.filter(s=>s.pay==='tarjeta').reduce((a,b)=>a+parseFloat(b.total),0)
              const totalV = totalEfectivo + totalTarjeta
              const r1 = totalV>0?totalEfectivo/totalV:0
              const cx=60, cy=60, radius=50
              const arc = (pct: number) => {
                if(pct>=1) return `M ${cx} ${cy-radius} A ${radius} ${radius} 0 1 1 ${cx-0.01} ${cy-radius} Z`
                const a = pct*2*Math.PI - Math.PI/2
                return `M ${cx} ${cy-radius} A ${radius} ${radius} 0 ${pct>0.5?1:0} 1 ${cx+radius*Math.cos(a)} ${cy+radius*Math.sin(a)} L ${cx} ${cy} Z`
              }
              return (
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16,background:C.s2,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px'}}>
                    <svg width="120" height="120" style={{flexShrink:0}}>
                      <circle cx={cx} cy={cy} r={radius} fill={C.s3}/>
                      {totalEfectivo>0&&<path d={arc(r1)} fill={C.green} opacity="0.9"/>}
                      {totalTarjeta>0&&totalV>0&&(()=>{
                        const startA = r1*2*Math.PI - Math.PI/2
                        const endA   = (r1 + totalTarjeta/totalV)*2*Math.PI - Math.PI/2
                        const laf    = totalTarjeta/totalV>0.5?1:0
                        const d = `M ${cx+radius*Math.cos(startA)} ${cy+radius*Math.sin(startA)} A ${radius} ${radius} 0 ${laf} 1 ${cx+radius*Math.cos(endA)} ${cy+radius*Math.sin(endA)} L ${cx} ${cy} Z`
                        return <path d={d} fill={C.accent} opacity="0.9"/>
                      })()}
                      <circle cx={cx} cy={cy} r={30} fill={C.s2}/>
                      <text x={cx} y={cy+4} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.text}>{ventas.length}</text>
                      <text x={cx} y={cy+16} textAnchor="middle" fontSize="8" fill={C.text2}>tickets</text>
                    </svg>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                        <span style={{width:10,height:10,borderRadius:'50%',background:C.green,display:'inline-block'}}></span>
                        <span style={{fontSize:11,color:C.text2}}>Efectivo</span>
                        <span style={{marginLeft:'auto',fontFamily:'monospace',fontWeight:700,color:C.green,fontSize:12}}>{fmtN(totalEfectivo)} €</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                        <span style={{width:10,height:10,borderRadius:'50%',background:C.accent,display:'inline-block'}}></span>
                        <span style={{fontSize:11,color:C.text2}}>Tarjeta</span>
                        <span style={{marginLeft:'auto',fontFamily:'monospace',fontWeight:700,color:C.accent,fontSize:12}}>{fmtN(totalTarjeta)} €</span>
                      </div>
                      {rects.length>0&&<div style={{fontSize:10,color:C.red,marginTop:4}}>↩️ {rects.length} rectificativo(s)</div>}
                      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:6,fontFamily:'monospace',fontWeight:800,fontSize:14,color:C.text}}>Total: {fmtN(totalV)} €</div>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                    {sales.map(s=>(
                      <div key={s.id} onClick={()=>setTicketModal(s)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:'11px 13px',cursor:'pointer'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                          <span style={{fontFamily:'monospace',fontSize:12,fontWeight:700,color:s.type==='rectificativo'?C.red:C.accent}}>{s.ticket_id}</span>
                          <span style={{fontSize:14,fontWeight:700,color:s.type==='rectificativo'?C.red:C.green,fontFamily:'monospace'}}>{s.type==='rectificativo'?'−':''}{fmtN(Math.abs(parseFloat(s.total)))} €</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.text2}}>
                          <span>{s.date} {s.time}</span>
                          <span>{s.pay==='efectivo'?'💵':'💳'} {s.cashier_name}</span>
                        </div>
                        <div style={{fontSize:10,color:C.text3,marginTop:3,textAlign:'right' as const}}>👁 Ver ticket</div>
                      </div>
                    ))}
                    {!sales.length&&<div style={{textAlign:'center' as const,color:C.text3,padding:30}}>Sin ventas</div>}
                  </div>
                </div>
              )
            })()}

            {/* ── CAJA ── */}
            {histTab==='caja'&&(
              <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                {cajaList.map((r:any)=>{
                  const dif = parseFloat(r.diferencia||0)
                  const difColor = dif===0?C.green:dif>0?C.teal:C.red
                  return (
                    <div key={r.id} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13}}>{r.status==='abierto'?'🟢 Abierta':'🔴 Cerrada'}</div>
                          <div style={{fontSize:11,color:C.text2}}>{r.opened_by_name} · {r.opened_at?new Date(r.opened_at).toLocaleDateString('es-ES'):''}</div>
                        </div>
                        <div style={{textAlign:'right' as const}}>
                          <div style={{fontFamily:'monospace',fontWeight:800,fontSize:15,color:difColor}}>
                            {dif===0?'✓':dif>0?`+${fmtN(dif)}`:fmtN(dif)} €
                          </div>
                          <div style={{fontSize:9,color:C.text3}}>{dif===0?'cuadrada':dif>0?'sobrante':'faltante'}</div>
                        </div>
                      </div>
                      {r.status==='cerrado'&&(
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                          {[
                            ['Fondo',fmtN(parseFloat(r.fondo_inicial||0)),C.text],
                            ['Ventas ef.',fmtN(parseFloat(r.ventas_efectivo||0)),C.green],
                            ['Esperado',fmtN(parseFloat(r.esperado||0)),C.text],
                            ['Real',fmtN(parseFloat(r.real_contado||0)),difColor],
                            ['Tarjeta',fmtN(parseFloat(r.ventas_tarjeta||0)),C.accent],
                            ['REBU',`-${fmtN(parseFloat(r.rebu_pagado||0))}`,C.red],
                          ].map(([l,v,c])=>(
                            <div key={l as string} style={{background:C.s3,borderRadius:6,padding:'5px 8px',textAlign:'center' as const}}>
                              <div style={{fontSize:8,color:C.text3,marginBottom:1}}>{l}</div>
                              <div style={{fontFamily:'monospace',fontWeight:700,fontSize:11,color:c as string}}>{v} €</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {!cajaList.length&&<div style={{textAlign:'center' as const,color:C.text3,padding:30}}>Sin arqueos</div>}
              </div>
            )}

            {/* ── COMPRAS ── */}
            {histTab==='compras'&&(()=>{
              const totalFacturas = comprasList.reduce((a:number,b:any)=>a+parseFloat(b.invoice_total||0),0)
              const totalRebu = rebuList.reduce((a:number,b:any)=>a+parseFloat(b.buy_price||0),0)
              const total = totalFacturas + totalRebu
              const r1 = total>0?totalRebu/total:0
              const cx=50,cy=50,radius=42
              const arc2 = (pct: number, start: number) => {
                if(pct<=0) return ''
                if(pct>=1) return `M ${cx} ${cy-radius} A ${radius} ${radius} 0 1 1 ${cx-0.01} ${cy-radius} Z`
                const a0 = start*2*Math.PI - Math.PI/2
                const a1 = (start+pct)*2*Math.PI - Math.PI/2
                return `M ${cx+radius*Math.cos(a0)} ${cy+radius*Math.sin(a0)} A ${radius} ${radius} 0 ${pct>0.5?1:0} 1 ${cx+radius*Math.cos(a1)} ${cy+radius*Math.sin(a1)} L ${cx} ${cy} Z`
              }
              return (
                <div>
                  {total>0&&(
                    <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16,background:C.s2,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px'}}>
                      <svg width="100" height="100" style={{flexShrink:0}}>
                        <circle cx={cx} cy={cy} r={radius} fill={C.s3}/>
                        {totalRebu>0&&<path d={arc2(r1,0)} fill={C.teal} opacity="0.9"/>}
                        {totalFacturas>0&&<path d={arc2(totalFacturas/total,r1)} fill={C.amber} opacity="0.9"/>}
                        <circle cx={cx} cy={cy} r={22} fill={C.s2}/>
                        <text x={cx} y={cy+4} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.text}>{fmtN(total)}</text>
                        <text x={cx} y={cy+14} textAnchor="middle" fontSize="7" fill={C.text2}>€</text>
                      </svg>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                          <span style={{width:10,height:10,borderRadius:'50%',background:C.teal,display:'inline-block'}}></span>
                          <span style={{fontSize:11,color:C.text2}}>REBU ({rebuList.length})</span>
                          <span style={{marginLeft:'auto',fontFamily:'monospace',fontWeight:700,color:C.teal,fontSize:11}}>{fmtN(totalRebu)} €</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{width:10,height:10,borderRadius:'50%',background:C.amber,display:'inline-block'}}></span>
                          <span style={{fontSize:11,color:C.text2}}>Facturas ({comprasList.length})</span>
                          <span style={{marginLeft:'auto',fontFamily:'monospace',fontWeight:700,color:C.amber,fontSize:11}}>{fmtN(totalFacturas)} €</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{fontSize:11,fontWeight:700,color:C.text2,marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'.05em'}}>♻️ Compras REBU</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:7,marginBottom:14}}>
                    {rebuList.map((r:any)=>(
                      <div key={r.id} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div style={{fontWeight:600,fontSize:12}}>{r.ref}</div>
                            <div style={{fontSize:11,color:C.text2}}>{r.description}</div>
                            <div style={{fontSize:10,color:C.text3}}>{r.seller_name} · {r.seller_dni}</div>
                          </div>
                          <div style={{textAlign:'right' as const}}>
                            <div style={{fontFamily:'monospace',fontWeight:700,color:C.teal,fontSize:13}}>{fmtN(parseFloat(r.buy_price))} €</div>
                            <div style={{fontSize:9,color:C.text3}}>compra</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!rebuList.length&&<div style={{textAlign:'center' as const,color:C.text3,padding:20}}>Sin compras REBU</div>}
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:C.text2,marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'.05em'}}>📄 Facturas proveedores</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:7}}>
                    {comprasList.map((r:any)=>(
                      <div key={r.id} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div style={{fontWeight:600,fontSize:12}}>{r.ref}</div>
                            <div style={{fontSize:11,color:C.text2}}>{r.supplier_name}</div>
                            <div style={{fontSize:10,color:C.text3}}>{r.invoice_date}</div>
                          </div>
                          <div style={{fontFamily:'monospace',fontWeight:700,color:C.amber,fontSize:13}}>{fmtN(parseFloat(r.invoice_total||0))} €</div>
                        </div>
                      </div>
                    ))}
                    {!comprasList.length&&<div style={{textAlign:'center' as const,color:C.text3,padding:20}}>Sin facturas</div>}
                  </div>
                </div>
              )
            })()}

            {/* ── RESERVAS ── */}
            {histTab==='reservas'&&(()=>{
              const activas   = reservasList.filter((r:any)=>r.status==='activa')
              const vencidas  = reservasList.filter((r:any)=>r.status==='vencida')
              const totalAbonado  = activas.reduce((a:number,b:any)=>a+parseFloat(b.abono||0),0)
              const totalPendiente= activas.reduce((a:number,b:any)=>a+(parseFloat(b.price)*b.qty-parseFloat(b.abono||0)),0)
              const total = totalAbonado+totalPendiente
              const cx=50,cy=50,radius=42
              const pctAb = total>0?totalAbonado/total:0
              const arcR = (pct: number, start: number) => {
                if(pct<=0) return ''
                if(pct>=1) return `M ${cx} ${cy-radius} A ${radius} ${radius} 0 1 1 ${cx-0.01} ${cy-radius} Z`
                const a0 = start*2*Math.PI - Math.PI/2
                const a1 = (start+pct)*2*Math.PI - Math.PI/2
                return `M ${cx+radius*Math.cos(a0)} ${cy+radius*Math.sin(a0)} A ${radius} ${radius} 0 ${pct>0.5?1:0} 1 ${cx+radius*Math.cos(a1)} ${cy+radius*Math.sin(a1)} L ${cx} ${cy} Z`
              }
              return (
                <div>
                  {activas.length>0&&(
                    <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:16,background:C.s2,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px'}}>
                      <svg width="100" height="100" style={{flexShrink:0}}>
                        <circle cx={cx} cy={cy} r={radius} fill={C.s3}/>
                        {totalAbonado>0&&<path d={arcR(pctAb,0)} fill={C.green} opacity="0.9"/>}
                        {totalPendiente>0&&<path d={arcR(1-pctAb,pctAb)} fill={C.amber} opacity="0.9"/>}
                        <circle cx={cx} cy={cy} r={22} fill={C.s2}/>
                        <text x={cx} y={cy+4} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.text}>{activas.length}</text>
                        <text x={cx} y={cy+14} textAnchor="middle" fontSize="7" fill={C.text2}>activas</text>
                      </svg>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                          <span style={{width:10,height:10,borderRadius:'50%',background:C.green,display:'inline-block'}}></span>
                          <span style={{fontSize:11,color:C.text2}}>Abonado</span>
                          <span style={{marginLeft:'auto',fontFamily:'monospace',fontWeight:700,color:C.green,fontSize:11}}>{fmtN(totalAbonado)} €</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{width:10,height:10,borderRadius:'50%',background:C.amber,display:'inline-block'}}></span>
                          <span style={{fontSize:11,color:C.text2}}>Pendiente</span>
                          <span style={{marginLeft:'auto',fontFamily:'monospace',fontWeight:700,color:C.amber,fontSize:11}}>{fmtN(totalPendiente)} €</span>
                        </div>
                        {vencidas.length>0&&<div style={{fontSize:10,color:C.red,marginTop:6}}>⚠️ {vencidas.length} vencida(s)</div>}
                      </div>
                    </div>
                  )}
                  <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                    {reservasList.map((r:any)=>{
                      const pendiente = parseFloat(r.price)*r.qty - parseFloat(r.abono||0)
                      const isVencida = r.status==='vencida'
                      return (
                        <div key={r.id} style={{background:C.s2,border:`1px solid ${isVencida?C.red:C.border}`,borderRadius:10,padding:'11px 13px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                            <div>
                              <div style={{fontWeight:600,fontSize:12}}>{r.product_emoji} {r.product_name}</div>
                              <div style={{fontSize:11,color:C.text2}}>👤 {r.clients?.name}</div>
                            </div>
                            <div style={{textAlign:'right' as const}}>
                              {isVencida&&<div style={{fontSize:9,color:C.red,fontWeight:700,marginBottom:2}}>⚠️ VENCIDA</div>}
                              <div style={{fontFamily:'monospace',fontWeight:700,color:C.accent,fontSize:13}}>{fmtN(parseFloat(r.price)*r.qty)} €</div>
                            </div>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5}}>
                            <div style={{background:C.s3,borderRadius:6,padding:'4px 6px',textAlign:'center' as const}}>
                              <div style={{fontSize:8,color:C.text3}}>Abonado</div>
                              <div style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:'monospace'}}>{fmtN(parseFloat(r.abono||0))} €</div>
                            </div>
                            <div style={{background:C.s3,borderRadius:6,padding:'4px 6px',textAlign:'center' as const}}>
                              <div style={{fontSize:8,color:C.text3}}>Pendiente</div>
                              <div style={{fontSize:11,fontWeight:700,color:C.amber,fontFamily:'monospace'}}>{fmtN(pendiente)} €</div>
                            </div>
                            <div style={{background:C.s3,borderRadius:6,padding:'4px 6px',textAlign:'center' as const}}>
                              <div style={{fontSize:8,color:C.text3}}>Plazo</div>
                              <div style={{fontSize:10,fontWeight:700,color:isVencida?C.red:C.text}}>{r.plazo_fecha}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {!reservasList.length&&<div style={{textAlign:'center' as const,color:C.text3,padding:30}}>Sin reservas activas</div>}
                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      )}

      {/* STOCK TAB */}
      {tab==='stock'&&(
        <div style={{padding:'10px 12px'}}>
          <input style={{...inp,marginBottom:10}} placeholder="🔍 Buscar..." value={stockSearch} onChange={e=>setStockSearch(e.target.value)}/>
          <div style={{display:'flex',flexDirection:'column' as const,gap:7}}>
            {filteredStock.map(p=>(
              <div key={p.id} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:'11px 13px',display:'flex',alignItems:'center',gap:10,opacity:!p.active?.5:1}}>
                <span style={{fontSize:22,flexShrink:0}}>{p.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>{p.name}</div>
                  <div style={{fontSize:11,color:C.text2}}>
                    <span style={{color:p.regime==='rebu'?C.teal:C.accent,marginRight:8}}>{p.regime==='rebu'?'REBU':`IVA ${p.iva_rate}%`}</span>
                    <span>{fmt(parseFloat(p.price))}</span>
                  </div>
                </div>
                <div style={{textAlign:'right' as const,flexShrink:0}}>
                  <div style={{fontSize:20,fontWeight:700,fontFamily:'monospace',color:p.stock===0?C.red:p.stock<5?C.amber:C.green}}>{p.stock}</div>
                  <div style={{fontSize:9,color:C.text3}}>uds.</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NUEVO TAB */}
      {tab==='nuevo'&&(
        <div style={{padding:'12px 14px'}}>

          {/* MENU */}
          {nuevoSub==='menu'&&(
            <>
              <div style={{fontSize:16,fontWeight:700,marginBottom:16}}>➕ Crear nuevo</div>
              {([
                ['producto','📦','Producto simple','Añadir un producto al inventario directamente',C.accent],
                ['factura','🧾','Factura de compra','Artículos nuevos de proveedor con factura',C.green],
                ['rebu','♻️','Compra REBU','Segunda mano comprada a particular (DNI obligatorio)',C.teal],
                ['deposito','🏷️','Empeño / Depósito','Artículo dejado por un cliente',C.amber],
              ] as [NuevoSub,string,string,string,string][]).map(([sub,icon,title,desc,color])=>(
                <div key={sub} onClick={()=>setNuevoSub(sub)} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px',marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:28,flexShrink:0}}>{icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color,marginBottom:3}}>{title}</div>
                    <div style={{fontSize:11,color:C.text2}}>{desc}</div>
                  </div>
                  <span style={{color:C.text3,fontSize:18}}>›</span>
                </div>
              ))}
            </>
          )}

          {/* PRODUCTO SIMPLE */}
          {nuevoSub==='producto'&&(
            <>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                <button onClick={()=>setNuevoSub('menu')} style={{background:'none',border:'none',color:C.text2,cursor:'pointer',fontSize:20}}>←</button>
                <span style={{fontSize:16,fontWeight:700}}>📦 Producto simple</span>
              </div>
              <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                <div><label style={lbl}>Nombre *</label><input style={inp} value={prdForm.name||''} onChange={e=>setP('name',e.target.value)} placeholder="Nombre del producto"/></div>
                <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:10}}>
                  <div><label style={lbl}>Emoji</label><input style={inp} value={prdForm.emoji||'📦'} onChange={e=>setP('emoji',e.target.value)} maxLength={4}/></div>
                  <div><label style={lbl}>Categoría</label>
                    <select style={{...inp,cursor:'pointer'}} value={prdForm.category_id||''} onChange={e=>setP('category_id',parseInt(e.target.value))}>
                      <option value="">Sin categoría</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><label style={lbl}>Precio venta (€) *</label><input style={inp} type="number" step="0.01" min="0" value={prdForm.price||''} onChange={e=>setP('price',parseFloat(e.target.value))} placeholder="0.00"/></div>
                  <div><label style={lbl}>Stock inicial</label><input style={inp} type="number" min="0" value={prdForm.stock||0} onChange={e=>setP('stock',parseInt(e.target.value))}/></div>
                </div>
                <div>
                  <label style={lbl}>Régimen fiscal</label>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                    {([['iva4','IVA 4%',4],['iva10','IVA 10%',10],['iva21','IVA 21%',21],['rebu','REBU',21]] as [string,string,number][]).map(([key,label,rate])=>{
                      const isRebu=key==='rebu'
                      const sel=isRebu?prdForm.regime==='rebu':(prdForm.regime==='iva'&&prdForm.iva_rate===rate)
                      return <button key={key} type="button" onClick={()=>setPrdForm((p:any)=>({...p,regime:isRebu?'rebu':'iva',iva_rate:rate}))} style={{padding:'8px 4px',borderRadius:8,border:`1px solid ${sel?C.accent:C.border}`,background:sel?'rgba(124,111,255,.15)':C.s2,color:sel?C.accent:C.text2,cursor:'pointer',fontSize:10,fontWeight:600,fontFamily:'inherit'}}>{label}</button>
                    })}
                  </div>
                </div>
                {prdForm.regime==='rebu'&&<div><label style={lbl}>Precio de coste (€)</label><input style={inp} type="number" step="0.01" min="0" value={prdForm.cost_price||''} onChange={e=>setP('cost_price',parseFloat(e.target.value))} placeholder="0.00"/></div>}
                <button onClick={savePrd} disabled={loading} style={btn(C.amber,'#000')}>{loading?'...':'💾 Crear producto'}</button>
              </div>
            </>
          )}

          {/* FACTURA */}
          {nuevoSub==='factura'&&(
            <>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                <button onClick={()=>setNuevoSub('menu')} style={{background:'none',border:'none',color:C.text2,cursor:'pointer',fontSize:20}}>←</button>
                <span style={{fontSize:16,fontWeight:700}}>🧾 Factura de compra</span>
              </div>
              <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                <div style={{background:C.s2,borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green,textTransform:'uppercase' as const,marginBottom:10}}>Proveedor y factura</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                    <div><label style={lbl}>Nombre proveedor *</label><input style={inp} value={facForm.supplier_name||''} onChange={e=>setFac('supplier_name',e.target.value)} placeholder="Distribuidor S.A."/></div>
                    <div><label style={lbl}>NIF/CIF proveedor *</label><input style={inp} value={facForm.supplier_nif||''} onChange={e=>setFac('supplier_nif',e.target.value)} placeholder="B12345678"/></div>
                    <div><label style={lbl}>Nº factura *</label><input style={inp} value={facForm.supplier_invoice||''} onChange={e=>setFac('supplier_invoice',e.target.value)} placeholder="FAC-2026-001"/></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div><label style={lbl}>Fecha factura *</label><input style={inp} type="date" value={facForm.invoice_date||''} onChange={e=>setFac('invoice_date',e.target.value)}/></div>
                      <div><label style={lbl}>Total factura (€) *</label><input style={inp} type="number" step="0.01" value={facForm.invoice_total||''} onChange={e=>setFac('invoice_total',parseFloat(e.target.value))} placeholder="0.00"/></div>
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:13,fontWeight:600}}>Artículos ({facItems.length})</span>
                  <button onClick={()=>setFacItems(p=>[...p,{name:'',emoji:'📦',category_id:'',qty:1,unit_cost:0,sale_price:0,iva_rate:21}])} style={{background:'none',border:`1px solid ${C.green}`,borderRadius:8,padding:'5px 10px',color:C.green,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>+ Añadir</button>
                </div>
                {facItems.map((item,idx)=>(
                  <div key={idx} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
                    <div style={{display:'flex',gap:8,marginBottom:8}}>
                      <div style={{width:60}}><label style={lbl}>Emoji</label><input style={inp} value={item.emoji} onChange={e=>setFacItem(idx,'emoji',e.target.value)} maxLength={4}/></div>
                      <div style={{flex:1}}><label style={lbl}>Nombre *</label><input style={inp} value={item.name} onChange={e=>setFacItem(idx,'name',e.target.value)} placeholder="Artículo"/></div>
                      {facItems.length>1&&<button onClick={()=>setFacItems(p=>p.filter((_,i)=>i!==idx))} style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:18,alignSelf:'flex-end',paddingBottom:4}}>✕</button>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div><label style={lbl}>Categoría</label>
                        <select style={{...inp,cursor:'pointer'}} value={item.category_id} onChange={e=>setFacItem(idx,'category_id',parseInt(e.target.value))}>
                          <option value="">Sin cat.</option>
                          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Uds.</label><input style={inp} type="number" min="1" value={item.qty} onChange={e=>setFacItem(idx,'qty',parseInt(e.target.value))}/></div>
                      <div><label style={lbl}>Coste unit. (€)</label><input style={inp} type="number" step="0.01" value={item.unit_cost} onChange={e=>setFacItem(idx,'unit_cost',parseFloat(e.target.value))}/></div>
                      <div><label style={lbl}>P. Venta (€) *</label><input style={inp} type="number" step="0.01" value={item.sale_price} onChange={e=>setFacItem(idx,'sale_price',parseFloat(e.target.value))}/></div>
                    </div>
                  </div>
                ))}
                <button onClick={saveFactura} disabled={loading} style={btn(C.green)}>{loading?'...':'💾 Registrar y generar PDF'}</button>
              </div>
            </>
          )}

          {/* REBU */}
          {nuevoSub==='rebu'&&(
            <>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                <button onClick={()=>setNuevoSub('menu')} style={{background:'none',border:'none',color:C.text2,cursor:'pointer',fontSize:20}}>←</button>
                <span style={{fontSize:16,fontWeight:700}}>♻️ Compra REBU</span>
              </div>
              <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                <div style={{background:C.s2,borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:'uppercase' as const,marginBottom:10}}>Vendedor (particular)</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                    <div><label style={lbl}>Nombre completo *</label><input style={inp} value={rebuForm.seller_name||''} onChange={e=>setReb('seller_name',e.target.value)}/></div>
                    <div><label style={lbl}>DNI / NIE * (obligatorio REBU)</label><input style={inp} value={rebuForm.seller_dni||''} onChange={e=>setReb('seller_dni',e.target.value)} placeholder="12345678A"/></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div><label style={lbl}>Teléfono</label><input style={inp} value={rebuForm.seller_phone||''} onChange={e=>setReb('seller_phone',e.target.value)}/></div>
                      <div><label style={lbl}>Dirección</label><input style={inp} value={rebuForm.seller_address||''} onChange={e=>setReb('seller_address',e.target.value)}/></div>
                    </div>
                  </div>
                </div>
                <div style={{background:C.s2,borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:'uppercase' as const,marginBottom:10}}>Artículo</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                    <div style={{display:'grid',gridTemplateColumns:'70px 1fr',gap:8}}>
                      <div><label style={lbl}>Emoji</label><input style={inp} value={rebuForm.emoji||'♻️'} onChange={e=>setReb('emoji',e.target.value)} maxLength={4}/></div>
                      <div><label style={lbl}>Descripción *</label><input style={inp} value={rebuForm.description||''} onChange={e=>setReb('description',e.target.value)} placeholder="Ej: iPhone 12 64GB"/></div>
                    </div>
                    <div><label style={lbl}>Categoría</label>
                      <select style={{...inp,cursor:'pointer'}} value={rebuForm.category_id||''} onChange={e=>setReb('category_id',parseInt(e.target.value))}>
                        <option value="">Sin categoría</option>
                        {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div><label style={lbl}>Precio compra (€) *</label><input style={inp} type="number" step="0.01" value={rebuForm.buy_price||''} onChange={e=>setReb('buy_price',parseFloat(e.target.value))}/></div>
                      <div><label style={lbl}>Precio venta prev. (€) *</label><input style={inp} type="number" step="0.01" value={rebuForm.sale_price||''} onChange={e=>setReb('sale_price',parseFloat(e.target.value))}/></div>
                    </div>
                    {rebuForm.buy_price>0&&rebuForm.sale_price>0&&(
                      <div style={{background:C.s3,padding:'6px 10px',borderRadius:6,fontSize:11,color:C.text2}}>
                        Margen: <b style={{color:C.green}}>{fmtN(rebuForm.sale_price-rebuForm.buy_price)} €</b> · IVA s/margen: <b style={{color:C.amber}}>{fmtN((rebuForm.sale_price-rebuForm.buy_price)*21/121)} €</b>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={saveRebu} disabled={loading} style={btn(C.teal)}>{loading?'...':'💾 Registrar y generar PDF'}</button>
              </div>
            </>
          )}

          {/* DEPÓSITO / EMPEÑO */}
          {nuevoSub==='deposito'&&(
            <>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                <button onClick={()=>setNuevoSub('menu')} style={{background:'none',border:'none',color:C.text2,cursor:'pointer',fontSize:20}}>←</button>
                <span style={{fontSize:16,fontWeight:700}}>🏷️ Empeño / Depósito</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                {[['deposito','📦 Depósito','El cliente cobra si se vende'],['empeno','🏷️ Empeño','Préstamo a cambio del artículo']].map(([type,label,desc])=>(
                  <div key={type} onClick={()=>setDep('deposit_type',type)} style={{padding:10,borderRadius:10,border:`2px solid ${depForm.deposit_type===type?C.amber:C.border}`,background:depForm.deposit_type===type?'rgba(245,159,0,.1)':C.s2,cursor:'pointer'}}>
                    <div style={{fontWeight:700,fontSize:12,color:depForm.deposit_type===type?C.amber:C.text,marginBottom:3}}>{label}</div>
                    <div style={{fontSize:10,color:C.text2}}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                <div style={{background:C.s2,borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase' as const,marginBottom:10}}>Datos del cliente</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                    <div><label style={lbl}>Nombre completo *</label><input style={inp} value={depForm.client_name||''} onChange={e=>setDep('client_name',e.target.value)}/></div>
                    <div><label style={lbl}>DNI / NIE *</label><input style={inp} value={depForm.client_dni||''} onChange={e=>setDep('client_dni',e.target.value)} placeholder="12345678A"/></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div><label style={lbl}>Teléfono</label><input style={inp} value={depForm.client_phone||''} onChange={e=>setDep('client_phone',e.target.value)}/></div>
                      <div><label style={lbl}>Dirección</label><input style={inp} value={depForm.client_address||''} onChange={e=>setDep('client_address',e.target.value)}/></div>
                    </div>
                  </div>
                </div>
                <div style={{background:C.s2,borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase' as const,marginBottom:10}}>Artículo y condiciones</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
                    <div style={{display:'grid',gridTemplateColumns:'70px 1fr',gap:8}}>
                      <div><label style={lbl}>Emoji</label><input style={inp} value={depForm.emoji||'📦'} onChange={e=>setDep('emoji',e.target.value)} maxLength={4}/></div>
                      <div><label style={lbl}>Descripción *</label><input style={inp} value={depForm.description||''} onChange={e=>setDep('description',e.target.value)} placeholder="Ej: Reloj dorado"/></div>
                    </div>
                    <div><label style={lbl}>Categoría</label>
                      <select style={{...inp,cursor:'pointer'}} value={depForm.category_id||''} onChange={e=>setDep('category_id',parseInt(e.target.value))}>
                        <option value="">Sin categoría</option>
                        {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div><label style={lbl}>Valor tasado (€)</label><input style={inp} type="number" step="0.01" value={depForm.appraised_value||''} onChange={e=>setDep('appraised_value',parseFloat(e.target.value))}/></div>
                      <div><label style={lbl}>{depForm.deposit_type==='empeno'?'Importe prestado':'P. venta acordado'} (€) *</label><input style={inp} type="number" step="0.01" value={depForm.agreed_price||''} onChange={e=>setDep('agreed_price',parseFloat(e.target.value))}/></div>
                      <div><label style={lbl}>Comisión tienda (%)</label><input style={inp} type="number" step="0.5" min="0" max="100" value={depForm.commission_pct||20} onChange={e=>setDep('commission_pct',parseFloat(e.target.value))}/></div>
                      <div><label style={lbl}>Fecha entrada</label><input style={inp} type="date" value={depForm.entry_date||new Date().toISOString().slice(0,10)} onChange={e=>setDep('entry_date',e.target.value)}/></div>
                    </div>
                    <div><label style={lbl}>Fecha límite / caducidad *</label><input style={inp} type="date" value={depForm.expiry_date||''} onChange={e=>setDep('expiry_date',e.target.value)}/></div>
                    {depForm.agreed_price>0&&depForm.commission_pct>0&&(
                      <div style={{background:C.s3,padding:'6px 10px',borderRadius:6,fontSize:11,color:C.text2}}>
                        Comisión: <b style={{color:C.amber}}>{fmtN(depForm.agreed_price*depForm.commission_pct/100)} €</b> · Cliente recibe: <b style={{color:C.green}}>{fmtN(depForm.agreed_price*(1-depForm.commission_pct/100))} €</b>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={saveDeposito} disabled={loading} style={btn(C.amber,'#000')}>{loading?'...':'💾 Registrar y generar PDF'}</button>
              </div>
            </>
          )}

        </div>
      )}

      </div>{/* end scroll container */}

      {/* BOTTOM TAB BAR */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,height:60,background:C.s1,borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',zIndex:100}}>
        {([['tpv','🧾','Venta'],['historial','📋','Historial'],['stock','📦','Stock'],['nuevo','➕','Nuevo']] as [MobileTab,string,string][])
          .filter(([t]) => t !== 'tpv' || user.role === 'cajero')
          .map(([t,icon,label])=>(
          <button key={t} onClick={()=>{setTab(t);if(t==='nuevo')setNuevoSub('menu')}} style={{flex:1,height:'100%',border:'none',background:'none',cursor:'pointer',display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',gap:3,color:tab===t?C.accent:C.text3,fontFamily:'inherit'}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:tab===t?700:400}}>{label}</span>
          </button>
        ))}
      </div>

      {/* CART MODAL */}
      {cartOpen&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:200,display:'flex',flexDirection:'column' as const,justifyContent:'flex-end'}}>
          <div style={{background:C.s1,borderRadius:'16px 16px 0 0',padding:'20px 16px',maxHeight:'85vh',overflowY:'auto' as const}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:700}}>🛒 Carrito ({cartCount})</span>
              <button onClick={()=>setCartOpen(false)} style={{background:'none',border:'none',color:C.text2,fontSize:20,cursor:'pointer'}}>✕</button>
            </div>
            {cart.map(i=>(
              <div key={i.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:20}}>{i.emoji}</span>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{i.name}</div><div style={{fontSize:11,color:C.text2}}>{fmt(i.price)}</div></div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>chgQty(i.id,-1)} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:C.s3,color:C.text,cursor:'pointer',fontSize:16}}>−</button>
                  <span style={{fontWeight:700,minWidth:20,textAlign:'center' as const}}>{i.qty}</span>
                  <button onClick={()=>chgQty(i.id,1)} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:C.s3,color:C.text,cursor:'pointer',fontSize:16}}>+</button>
                </div>
                <span style={{fontFamily:'monospace',fontWeight:700,color:C.green,minWidth:60,textAlign:'right' as const}}>{fmt(i.price*i.qty)}</span>
              </div>
            ))}
            <div style={{padding:'14px 0 8px',borderTop:`1px solid ${C.border}`,marginTop:4}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:18,fontWeight:700,marginBottom:14}}>
                <span>TOTAL</span><span style={{color:C.green,fontFamily:'monospace'}}>{fmt(cartTotal)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                {(['efectivo','tarjeta'] as const).map(m=>(
                  <button key={m} onClick={()=>setPayMethod(m)} style={{padding:12,borderRadius:10,border:`1px solid ${payMethod===m?C.accent:C.border}`,background:payMethod===m?'rgba(124,111,255,.15)':C.s2,color:payMethod===m?C.accent:C.text2,cursor:'pointer',fontSize:13,fontWeight:500,fontFamily:'inherit'}}>{m==='efectivo'?'💵 Efectivo':'💳 Tarjeta'}</button>
                ))}
              </div>
              <button onClick={checkout} disabled={loading} style={btn(C.green)}>{loading?'Procesando...':`Cobrar ${fmt(cartTotal)}`}</button>
              <button onClick={()=>{setCart([]);setCartOpen(false)}} style={{...btn(C.s3,C.text2),marginTop:8}}>Vaciar carrito</button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET MODAL */}
      {ticketModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',zIndex:300,display:'flex',flexDirection:'column' as const,justifyContent:'flex-end'}}
          onClick={e=>{if(e.target===e.currentTarget)setTicketModal(null)}}>
          <div style={{background:C.s1,borderRadius:'16px 16px 0 0',padding:'20px 16px',maxHeight:'90vh',overflowY:'auto' as const}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <div style={{fontSize:16,fontWeight:700}}>{ticketModal.type==='rectificativo'?'↩️ Rectificativo':'✅ Ticket'}</div>
                <div style={{fontSize:12,color:C.text2}}>{ticketModal.ticket_id} · {ticketModal.date} {ticketModal.time}</div>
              </div>
              <button onClick={()=>setTicketModal(null)} style={{background:'none',border:'none',color:C.text2,fontSize:22,cursor:'pointer'}}>✕</button>
            </div>
            <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:14}}
              dangerouslySetInnerHTML={{__html: buildTicketHTML(ticketModal)}} />
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setTicketModal(null)} style={{...btn(),flex:1,background:C.s3,color:C.text}}>Cerrar</button>
              <button onClick={()=>printMobileTicket(ticketModal)} style={{...btn(),flex:1}}>🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast&&(
        <div style={{position:'fixed',bottom:70,left:16,right:16,background:toast.ok?C.green:C.red,color:'#fff',padding:'12px 16px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:400,textAlign:'center' as const}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
