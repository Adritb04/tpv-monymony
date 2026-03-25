'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api-client'
import PurchasesModule from './PurchasesModule'
import MobileTPV from './MobileTPV'
import CashRegister from './CashRegister'
import ReportsModule from './ReportsModule'

// ── helpers ──────────────────────────────────────────────────────
const fmt = (n: number) => (n || 0).toFixed(2).replace('.', ',') + ' €'
const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')
const NEGOCIO = {
  nombre:       process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE       || 'MI TIENDA',
  razon_social: process.env.NEXT_PUBLIC_NEGOCIO_RAZON_SOCIAL || '',
  nif:          process.env.NEXT_PUBLIC_NEGOCIO_NIF          || 'B00000000',
  direccion:    process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION    || 'Calle Mayor, 1',
  cp:           process.env.NEXT_PUBLIC_NEGOCIO_CP           || '28001',
  localidad:    process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD    || 'Madrid',
  telefono:     process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO     || '',
  email:        process.env.NEXT_PUBLIC_NEGOCIO_EMAIL        || '',
  serie:        process.env.NEXT_PUBLIC_NEGOCIO_SERIE        || 'A',
}

// ── CSS-in-JS styles (inline for single-file component) ─────────
const S = {
  app: { display:'flex', flexDirection:'column' as const, height:'100vh', background:'var(--bg)', color:'var(--text)', fontFamily:"'DM Sans',system-ui,sans-serif" },
  topbar: { height:50, background:'var(--s1)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 16px', gap:8, flexShrink:0 },
  view: { flex:1, display:'flex', overflow:'hidden', minHeight:0 },
  // panels
  prdPanel: { flex:1, display:'flex', flexDirection:'column' as const, overflow:'hidden', borderRight:'1px solid var(--border)' },
  cartPanel: { width:310, flexShrink:0, display:'flex', flexDirection:'column' as const, background:'var(--s1)' },
  // inputs
  input: { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none', width:'100%' },
  // buttons
  btn: (color='var(--accent)') => ({ padding:'8px 14px', borderRadius:6, border:'none', background:color, color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', transition:'all .15s' }),
  btnOutline: { padding:'6px 11px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text2)', cursor:'pointer', fontSize:11, fontWeight:500, fontFamily:'inherit' },
  card: { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' },
  badge: (color: string, bg: string) => ({ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, color, background:bg }),
  modal: { position:'fixed' as const, inset:0, background:'rgba(26,29,46,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)' },
  modalBox: { background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:420, maxHeight:'90vh', overflowY:'auto' as const, boxShadow:'0 8px 32px rgba(89,122,166,.2)' },
  table: { width:'100%', borderCollapse:'collapse' as const },
  th: { textAlign:'left' as const, fontSize:10, color:'var(--text2)', fontWeight:600, padding:'6px 10px', borderBottom:'1px solid var(--border)', textTransform:'uppercase' as const, letterSpacing:'.05em' },
  td: { padding:'9px 10px', borderBottom:'1px solid var(--border)', fontSize:12, verticalAlign:'middle' as const },
}

// ── TICKET HTML ──────────────────────────────────────────────────
function buildTicketHTML(s: any): string {
  const isRect = s.type === 'rectificativo'
  const bd = s.iva_breakdown || {}

  // IVA lines
  let ivaLines = ''
  ;[4, 10, 21].forEach(r => {
    const g = bd[String(r)]
    if (g?.base > 0) ivaLines +=
      `<div class="row small"><span>Base IVA ${r}%</span><span>${fmtN(g.base)} EUR</span></div>` +
      `<div class="row small"><span>Cuota IVA ${r}%</span><span>${fmtN(g.iva)} EUR</span></div>`
  })

  // REBU
  const rebu = bd.rebu
  const rebuNote = rebu?.total > 0 ? `
    <div class="divider"></div>
    <div class="row small"><span>Arts. REBU</span><span>${fmtN(rebu.total)} EUR</span></div>
    <div class="small" style="font-size:10px">IVA incluido no deducible<br>Art. 135-139 LIVA</div>` : ''

  // Items
  const items = (s.items || []).map((i: any) => {
    const lt = i.line_total || i.price * i.qty
    return `<div class="row"><span>${i.name} x${i.qty}</span><span>${fmtN(lt)} EUR</span></div>` +
      `<div class="small" style="padding-left:4px">${i.regime === 'rebu' ? 'REBU' : 'IVA ' + i.iva_rate + '%'}</div>`
  }).join('')

  return `
<div class="center bold" style="font-size:17px">${NEGOCIO.nombre}</div>
${NEGOCIO.razon_social ? `<div class="center small">${NEGOCIO.razon_social}</div>` : ""}
<div class="center small">NIF: ${s.nif || NEGOCIO.nif}</div>
<div class="center small">${NEGOCIO.direccion}</div>
<div class="center small">${NEGOCIO.cp} ${NEGOCIO.localidad}</div>
${NEGOCIO.telefono ? `<div class="center small">Tel: ${NEGOCIO.telefono}</div>` : ''}
<div class="divider"></div>
${isRect ? `<div class="center bold rect">** FACTURA RECTIFICATIVA **</div>
<div class="row small rect"><span>Rectifica:</span><span>${s.rect_of}</span></div>
<div class="small rect">Motivo: ${s.rect_reason}</div>
<div class="divider"></div>` : ''}
<div class="bold">${isRect ? 'FACTURA RECTIFICATIVA' : 'FACTURA SIMPLIFICADA'}</div>
<div class="row small"><span>Ticket</span><span>${s.ticket_id}</span></div>
<div class="row small"><span>Fecha</span><span>${s.date} ${s.time}</span></div>
<div class="row small"><span>Cajero</span><span>${s.cashier_name}</span></div>
<div class="divider"></div>
${items}
<div class="divider"></div>
${ivaLines}
${rebuNote}
${(ivaLines || rebuNote) ? '<div class="divider"></div>' : ''}
<div class="row"><span>Base imponible</span><span>${fmtN(Math.abs(s.base))} EUR</span></div>
<div class="row"><span>IVA total</span><span>${fmtN(Math.abs(s.iva_total))} EUR</span></div>
<div class="divider-solid"></div>
<div class="row total">${isRect ? '** TOTAL RECTIFICADO **' : 'TOTAL'} ${isRect ? '-' : ''}${fmtN(Math.abs(s.total))} EUR</div>
<div class="row small"><span>Pago</span><span>${s.pay === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</span></div>
<div class="divider"></div>
<div class="small">${s.sw_name || 'TPV-Legal-ES'} v${s.sw_version || '1.0.0'}</div>
<div class="hash">Hash: ${(s.hash || '').substring(0, 32)}...</div>
<div class="center" style="margin-top:4px;font-size:14px;font-weight:700">*** Gracias por su compra ***</div>
<div class="divider"></div>
<div style="font-size:10px;margin-top:4px;line-height:1.4">Cambios y devoluciones presentando el ticket y maximo 15 dias.</div>
<div style="font-size:10px;margin-top:4px;line-height:1.4">E-Regimen especial bienes usados. Garantia segun condiciones generales. La Empresa garantiza que estos productos han sido probados en el momento de la venta y que funcionaban adecuadamente de conformidad a su descripcion, naturaleza y a su peculiar caracter de bien usado. La garantia cubre exclusivamente el funcionamiento del bien, excluyendose los defectos por instalacion, por trato inadecuado o uso impropio. El comprador, en el plazo de 1 ano, podra solicitar, cuando proceda, la reparacion del producto, la rebaja del precio o la resolucion del contrato conforme a lo establecido en la legislacion vigente. No podra exigirse al vendedor la sustitucion del bien, por ser producto de segunda mano, salvo que medie acuerdo entre ambas partes.</div>
<div style="font-size:10px;margin-top:4px;line-height:1.4">No se admiten devoluciones, si existieran se emite vale de tienda.</div>
<div style="height:20mm"></div>`
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function TPVApp() {
  const [token, setToken] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [user, setUser]   = useState<any>(null)
  const [view, setView]   = useState<'tpv' | 'history' | 'admin' | 'caja'>('tpv')
  const [clock, setClock] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // TPV state
  const [products, setProducts]   = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cart, setCart]           = useState<any[]>([])
  const [openCaja, setOpenCaja]       = useState<any>(null)
  const [cajaChecked, setCajaChecked]   = useState(false)
  const [aperturaModal, setAperturaModal] = useState(false)
  const [cierreModal, setCierreModal]   = useState(false)
  const [fondoInicial, setFondoInicial] = useState('')
  const [notasApertura, setNotasApertura] = useState('')

  const DENOM = [
    { value: 500, label: '500 €', type: 'billete' },
    { value: 200, label: '200 €', type: 'billete' },
    { value: 100, label: '100 €', type: 'billete' },
    { value: 50,  label: '50 €',  type: 'billete' },
    { value: 20,  label: '20 €',  type: 'billete' },
    { value: 10,  label: '10 €',  type: 'billete' },
    { value: 5,   label: '5 €',   type: 'billete' },
    { value: 2,   label: '2 €',   type: 'moneda' },
    { value: 1,   label: '1 €',   type: 'moneda' },
    { value: 0.50,label: '0,50 €',type: 'moneda' },
    { value: 0.20,label: '0,20 €',type: 'moneda' },
    { value: 0.10,label: '0,10 €',type: 'moneda' },
    { value: 0.05,label: '0,05 €',type: 'moneda' },
    { value: 0.02,label: '0,02 €',type: 'moneda' },
    { value: 0.01,label: '0,01 €',type: 'moneda' },
  ]
  const [apCounts, setApCounts] = useState<Record<string, string>>({})
  const totalAp = DENOM.reduce((s, d) => s + (parseFloat(apCounts[String(d.value)] || '0') || 0) * d.value, 0)
  const [realContado, setRealContado]   = useState('')
  const [notasCierre, setNotasCierre]   = useState('')
  const [cajaLoading, setCajaLoading]   = useState(false)
  const [payMethod, setPayMethod] = useState<'efectivo' | 'tarjeta'>('efectivo')
  const [efectivoEntregado, setEfectivoEntregado] = useState('')
  const [activeCat, setActiveCat] = useState(0) // 0 = all
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)

  // History
  const [sales, setSales]         = useState<any[]>([])
  const [salesCount, setSalesCount] = useState(0)
  const [histSearch, setHistSearch] = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Admin
  const [adminTab, setAdminTab]   = useState<'products' | 'categories' | 'users' | 'log' | 'compras' | 'informes'>('products')
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [opLog, setOpLog]         = useState<any[]>([])
  const [logKey, setLogKey]         = useState(0)
  const [integrity, setIntegrity] = useState<any>(null)

  // Modals
  const [ticketModal, setTicketModal] = useState<any>(null)
  const [pesoModal, setPesoModal]     = useState<any>(null)  // product selected for kg entry
  const [pesoKg, setPesoKg]           = useState('')
  const [quickModal, setQuickModal]   = useState(false)
  const [quickForm, setQuickForm]     = useState({ name:'', price:'', iva_rate:21, unit_type:'unidad', qty:1 })
  const [barcodeBuffer, setBarcodeBuffer] = useState('')
  const [barcodeToast, setBarcodeToast]   = useState<string|null>(null)
  const [rectModal, setRectModal]     = useState<any>(null)
  const [rectReason, setRectReason]   = useState('')
  const [formModal, setFormModal]     = useState<{ type: 'product' | 'category' | 'user'; data?: any } | null>(null)
  const [rgpdModal, setRgpdModal]     = useState(false)

  // Form state
  const [form, setForm] = useState<any>({})

  // ── Clock ──
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('es-ES')), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Toast ──
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load products & categories after login ──
  const loadProducts = useCallback(async () => {
    if (!token) return
    try {
      const [pr, ca] = await Promise.all([
        api.products.list(token),
        api.categories.list(token),
      ])
      setProducts(pr.data)
      setCategories(ca.data)
    } catch (e: any) { showToast(e.message, 'err') }
  }, [token])

  useEffect(() => {
    if (!token) return
    loadProducts()
    const interval = setInterval(loadProducts, 60000) // sync stock every 60s
    return () => clearInterval(interval)
  }, [token, loadProducts])

  // ── Load caja status ──
  const loadCaja = useCallback(async () => {
    if (!token || !user) return
    try {
      const res = await fetch('/api/cash-register?status=abierto&limit=1', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const j = await res.json()
      const open = (j.data || []).find((r: any) => r.status === 'abierto') || null
      setOpenCaja(open)
      setCajaChecked(true)
    } catch { setCajaChecked(true) }
  }, [token, user])

  useEffect(() => { if (token && user && sessionReady) loadCaja() }, [token, user, sessionReady, loadCaja])

  // ── Barcode scanner listener ──
  // Scanners type very fast + Enter. We capture that globally.
  useEffect(() => {
    if (!token) return
    let buf = ''
    let lastKey = 0
    const onKey = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const now = Date.now()
      if (now - lastKey > 300) buf = '' // reset if too slow (human typing)
      lastKey = now
      if (e.key === 'Enter' && buf.length >= 3) {
        const code = buf.trim()
        buf = ''
        // Lookup barcode
        fetch(`/api/products?barcode=${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(j => {
          if (j.data) {
            addToCartDirect(j.data, 1)
            setBarcodeToast(`✓ ${j.data.name} añadido`)
            setTimeout(() => setBarcodeToast(null), 2000)
          } else {
            setBarcodeToast(`⚠️ Código ${code} no encontrado`)
            setTimeout(() => setBarcodeToast(null), 2500)
          }
        }).catch(() => {})
      } else if (e.key !== 'Enter' && e.key.length === 1) {
        buf += e.key
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [token, products])

  // ── Apertura de caja ──
  const doApertura = async () => {
    if (!token) return
    setCajaLoading(true)
    try {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'apertura', fondo_inicial: totalAp, notes: notasApertura }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Caja abierta')
      setApCounts({}); setNotasApertura(''); setAperturaModal(false)
      loadCaja()
    } catch (e: any) { showToast(e.message, 'err') }
    finally { setCajaLoading(false) }
  }

  // ── Cierre de caja ──
  const doCierre = async () => {
    if (!token || !openCaja) return
    setCajaLoading(true)
    try {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'cierre', apertura_id: openCaja.id, real_contado: parseFloat(realContado) || 0, notes: notasCierre }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Caja cerrada')
      setRealContado(''); setNotasCierre(''); setCierreModal(false)
      loadCaja()
      // Print PDF cierre
      printCierreArqueo(j.data)
    } catch (e: any) { showToast(e.message, 'err') }
    finally { setCajaLoading(false) }
  }

  const printCierreArqueo = (r: any) => {
    const dif = parseFloat(r.diferencia)
    const difColor = dif === 0 ? '#2b8a3e' : dif > 0 ? '#1864ab' : '#c92a2a'
    const difText  = dif === 0 ? '✓ CUADRADA' : dif > 0 ? `SOBRANTE +${Math.abs(dif).toFixed(2)} €` : `FALTANTE -${Math.abs(dif).toFixed(2)} €`
    const NEGOCIO_L = {
      nombre: process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE || 'MI TIENDA',
      nif: process.env.NEXT_PUBLIC_NEGOCIO_NIF || '',
    }
    const w = window.open('', '_blank', 'width=700,height=900')!
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Arqueo de Caja</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#000;padding:24px}
    h1{font-size:18px;margin-bottom:2px}h2{font-size:13px;margin:14px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
    .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px}
    .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee}
    .row.total{font-weight:700;font-size:14px;border-top:2px solid #000;border-bottom:none;padding-top:6px}
    .box{border:1px solid #ddd;border-radius:6px;padding:12px;margin-bottom:12px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .sign-box{border:1px solid #999;border-radius:4px;min-height:60px;padding:8px;margin-top:6px}
    .signs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
    .footer{margin-top:20px;font-size:9px;color:#888;border-top:1px solid #ccc;padding-top:8px}</style></head><body>
    <div class="header">
      <div><h1>${NEGOCIO_L.nombre}</h1><div>NIF: ${NEGOCIO_L.nif}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700">ARQUEO DE CAJA</div>
      <div>Apertura: ${r.opened_at ? new Date(r.opened_at).toLocaleString('es-ES') : '-'}</div>
      <div>Cierre: ${r.closed_at ? new Date(r.closed_at).toLocaleString('es-ES') : '-'}</div></div>
    </div>
    <div class="grid2">
      <div class="box"><div style="font-weight:700;margin-bottom:8px">Apertura</div>
        <div class="row"><span>Fondo inicial</span><span><b>${parseFloat(r.fondo_inicial).toFixed(2)} €</b></span></div>
        <div class="row"><span>Abierta por</span><span>${r.opened_by_name}</span></div>
      </div>
      <div class="box"><div style="font-weight:700;margin-bottom:8px">Cierre</div>
        <div class="row"><span>Cerrada por</span><span>${r.closed_by_name}</span></div>
        ${r.notes ? `<div class="row"><span>Notas</span><span>${r.notes}</span></div>` : ''}
      </div>
    </div>
    <h2>Ventas del turno</h2>
    <div class="box">
      <div class="row"><span>Ventas en efectivo</span><span>${parseFloat(r.ventas_efectivo).toFixed(2)} €</span></div>
      <div class="row"><span>Ventas con tarjeta</span><span>${parseFloat(r.ventas_tarjeta).toFixed(2)} €</span></div>
      <div class="row total"><span>TOTAL VENTAS</span><span>${parseFloat(r.ventas_total).toFixed(2)} €</span></div>
    </div>
    <h2>Cuadre de caja</h2>
    <div class="box" style="border-color:${difColor}">
      <div class="row"><span>Fondo inicial</span><span>${parseFloat(r.fondo_inicial).toFixed(2)} €</span></div>
      <div class="row"><span>+ Ventas efectivo</span><span>${parseFloat(r.ventas_efectivo).toFixed(2)} €</span></div>
      <div class="row total"><span>ESPERADO EN CAJA</span><span>${parseFloat(r.esperado).toFixed(2)} €</span></div>
      <div class="row" style="margin-top:8px"><span>REAL CONTADO</span><span><b>${parseFloat(r.real_contado).toFixed(2)} €</b></span></div>
      <div class="row" style="margin-top:6px;padding-top:6px;border-top:2px solid #000;font-weight:700;font-size:15px;color:${difColor}">
        <span>DIFERENCIA</span><span>${difText}</span>
      </div>
    </div>
    <div class="signs">
      <div><div style="font-size:10px;color:#888">Firma del cajero</div><div class="sign-box"></div>
        <div style="font-size:10px;text-align:center;margin-top:4px">${r.closed_by_name}</div></div>
      <div><div style="font-size:10px;color:#888">Firma responsable / Sello</div><div class="sign-box"></div></div>
    </div>
    <div class="footer">TPV-Legal-ES · ${new Date().toLocaleString('es-ES')}</div>
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  // ── Load sales ──
  const loadSales = useCallback(async () => {
    if (!token) return
    try {
      const params: Record<string, string> = { limit: '100' }
      if (payFilter)  params.pay  = payFilter
      if (typeFilter) params.type = typeFilter
      if (histSearch) params.q    = histSearch
      const res = await api.sales.list(token, params)
      setSales(res.data || [])
      setSalesCount(res.count || 0)
    } catch (e: any) { showToast(e.message, 'err') }
  }, [token, payFilter, typeFilter, histSearch])

  useEffect(() => {
    if (view === 'history') {
      loadSales()
      const interval = setInterval(loadSales, 30000) // auto-refresh every 30s
      return () => clearInterval(interval)
    }
  }, [view, loadSales])

  // ── Load admin data ──
  const loadAdminTab = useCallback(async (tab: string) => {
    if (!token) return
    try {
      if (tab === 'users') {
        const res = await api.users.list(token)
        setAdminUsers(res.data)
      } else if (tab === 'log') {
        setOpLog([]) // clear stale state before fetch
        const res = await fetch('/api/log?limit=200&_t=' + Date.now(), {
          headers: { Authorization: `Bearer ${token}` }
        })
        const j = await res.json()
        setOpLog(j.data || [])
        setLogKey(k => k + 1)
      } else if (tab === 'integrity') {
        const res = await api.integrity(token)
        setIntegrity(res.data)
      } else if (tab === 'products') {
        loadProducts()
      }
    } catch (e: any) { showToast(e.message, 'err') }
  }, [token, loadProducts])

  useEffect(() => {
    if (view === 'admin') {
      loadAdminTab(adminTab)
      // Auto-refresh log and sales every 30s
      if (adminTab === 'log') {
        const interval = setInterval(() => loadAdminTab('log'), 30000)
        return () => clearInterval(interval)
      }
    }
  }, [view, adminTab, loadAdminTab])

  // ── LOGIN ──
  const doLogin = async (username: string, password: string) => {
    try {
      setLoading(true)
      const res = await api.login(username, password)
      setToken(res.token)
      setUser(res.user)
      // No localStorage persistence — session lives only in memory
    } catch (e: any) {
      showToast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  // No auto-login — always require manual login on page load
  useEffect(() => {
    localStorage.removeItem('tpv_token')
    localStorage.removeItem('tpv_user')
    setSessionReady(true)
  }, [])

  const doLogout = () => {
    setToken(null); setUser(null); setCart([])
    setOpenCaja(null); setCajaChecked(false)
    localStorage.removeItem('tpv_token')
    localStorage.removeItem('tpv_user')
  }

  // ── CART ──
  const addToCart = (prd: any) => {
    if (!prd.active || prd.stock === 0) return
    // kg products → open peso modal
    if (prd.unit_type === 'kg') {
      setPesoModal(prd)
      setPesoKg('')
      return
    }
    addToCartDirect(prd, 1)
  }

  const addToCartDirect = (prd: any, qty: number, customPrice?: number) => {
    const price = customPrice ?? parseFloat(prd.price)
    setCart(prev => {
      // kg products always add as new line (different weight each time)
      if (prd.unit_type === 'kg') {
        // price = price_per_kg, qty = kg weight, total = price * qty
        return [...prev, {
          id: prd.id, name: prd.name, emoji: prd.emoji,
          price, iva_rate: prd.iva_rate,
          regime: prd.regime, cost_price: parseFloat(prd.cost_price || 0),
          unit_type: 'kg', qty,
          label: `${qty} kg × ${price.toFixed(2).replace('.',',')} €/kg`,
        }]
      }
      const ex = prev.find(i => i.id === prd.id && !i.unit_type_kg)
      if (ex) {
        if (ex.qty >= prd.stock) return prev
        return prev.map(i => i.id === prd.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, {
        id: prd.id, name: prd.name, emoji: prd.emoji,
        price, iva_rate: prd.iva_rate,
        regime: prd.regime, cost_price: parseFloat(prd.cost_price || 0),
        unit_type: prd.unit_type || 'unidad', qty: 1,
      }]
    })
  }

  const addQuickItem = () => {
    const price = parseFloat(quickForm.price)
    if (!quickForm.name || !price || price <= 0) return
    const id = Date.now() // unique temp id
    setCart(prev => [...prev, {
      id,
      name: quickForm.name,
      emoji: '🏷️',
      price: price,  // always price per unit or price per kg
      iva_rate: quickForm.iva_rate,
      regime: 'iva',
      cost_price: 0,
      unit_type: quickForm.unit_type,
      qty: quickForm.unit_type === 'kg' ? quickForm.qty : quickForm.qty,
      label: quickForm.unit_type === 'kg' ? `${quickForm.qty} kg × ${price.toFixed(2).replace('.',',')} €/kg` : undefined,
      isQuick: true,
    }])
    setQuickModal(false)
    setQuickForm({ name:'', price:'', iva_rate:21, unit_type:'unidad', qty:1 })
  }

  const confirmPeso = () => {
    if (!pesoModal || !pesoKg) return
    const kg = parseFloat(pesoKg.replace(',', '.'))
    if (isNaN(kg) || kg <= 0) return
    const pricePerKg = parseFloat(pesoModal.price)
    // Store price_per_kg as price, qty as kg — total = price * qty
    addToCartDirect(pesoModal, kg, pricePerKg)
    setPesoModal(null)
    setPesoKg('')
  }

  const chgQty = (id: number, d: number) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + d } : i).filter(i => i.qty > 0))

  const calcTotals = () => {
    let base = 0, ivaTotal = 0
    const groups: Record<string, any> = {}
    cart.forEach(i => {
      // For kg items: price = total already calculated, qty = weight in kg
      const total = i.price * i.qty  // kg: price=€/kg, qty=kg → total=€; unidad: price=€/u, qty=u → total=€
      if (i.regime === 'rebu') {
        const margin = Math.max(0, i.price - i.cost_price) * i.qty
        const iva    = margin * i.iva_rate / (100 + i.iva_rate)
        if (!groups.rebu) groups.rebu = { margin: 0, iva: 0, total: 0 }
        groups.rebu.margin += margin
        groups.rebu.iva    += iva
        groups.rebu.total  += total
        ivaTotal += iva
        base     += total - iva
      } else {
        const b   = total / (1 + i.iva_rate / 100)
        const iva = total - b
        const key = String(i.iva_rate)
        if (!groups[key]) groups[key] = { base: 0, iva: 0, total: 0 }
        groups[key].base  += b
        groups[key].iva   += iva
        groups[key].total += total
        base     += b
        ivaTotal += iva
      }
    })
    return { base, ivaTotal, total: base + ivaTotal, groups }
  }

  const { base, ivaTotal, total, groups } = calcTotals()

  // ── CHECKOUT ──
  const checkout = async () => {
    if (!cart.length || !token) return
    if (user.role === 'cajero' && cajaChecked && !openCaja) {
      showToast('⚠️ Debes abrir la caja antes de vender', 'err')
      setView('caja')
      return
    }
    setLoading(true)
    try {
      const items = cart.map(i => {
        const lineTotal = i.price * i.qty  // price=€/kg * qty=kg OR price=€/u * qty=u
        const lineBase  = i.regime === 'rebu'
          ? lineTotal - Math.max(0, i.price - i.cost_price) * i.iva_rate / (100 + i.iva_rate)
          : lineTotal / (1 + i.iva_rate / 100)
        return {
          product_id: i.id,
          name: i.unit_type === 'kg' ? `${i.name} (${Number(i.qty).toFixed(3)} kg)` : i.name,
          emoji: i.emoji,
          price: i.price, qty: i.unit_type === 'kg' ? i.qty : i.qty,
          regime: i.regime, iva_rate: i.iva_rate, cost_price: i.cost_price,
          unit_type: i.unit_type || 'unidad',
          line_total: lineTotal,
          line_base:  lineBase,
          line_iva:   lineTotal - lineBase,
        }
      })
      const entregado = payMethod === 'efectivo' && efectivoEntregado ? parseFloat(efectivoEntregado) : null
      const cambio = entregado && entregado >= total ? Math.round((entregado - total) * 100) / 100 : null
      const res = await api.sales.create(token, { items, pay: payMethod, entregado, cambio })
      setCart([])
      setPayMethod('efectivo')
      setEfectivoEntregado('')
      loadProducts() // refresh stock
      setTicketModal(res.data)
      // Imprimir automáticamente en impresora térmica
      printTicket(res.data, true)
      showToast('Venta registrada ✓')
    } catch (e: any) {
      showToast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  // ── RECTIFY ──
  const confirmRect = async () => {
    if (!rectModal || !rectReason.trim() || !token) return
    setLoading(true)
    try {
      const res = await api.sales.rectify(token, { sale_id: rectModal.id, reason: rectReason })
      setRectModal(null)
      setRectReason('')
      loadSales()
      setTicketModal(res.data)
      showToast('Ticket rectificativo emitido ✓')
    } catch (e: any) {
      showToast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  // ── EXPORT ──
  const doExport = (format: string) => {
    if (!token) return
    const url = `/api/export?format=${format}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `TPV_${format}_${new Date().toISOString().slice(0, 10)}.${format}`
        a.click()
      })
      .catch(() => showToast('Error al exportar', 'err'))
  }

  // ── SAVE FORM ──
  const saveForm = async () => {
    if (!formModal || !token) return
    setLoading(true)
    try {
      if (formModal.type === 'product') {
        if (formModal.data?.id) await api.products.update(token, { id: formModal.data.id, ...form })
        else await api.products.create(token, form)
        loadProducts()
      } else if (formModal.type === 'category') {
        if (formModal.data?.id) await api.categories.update(token, { id: formModal.data.id, ...form })
        else await api.categories.create(token, form)
        loadProducts()
      } else if (formModal.type === 'user') {
        if (formModal.data?.id) await api.users.update(token, { id: formModal.data.id, ...form })
        else await api.users.create(token, form)
        const res = await api.users.list(token)
        setAdminUsers(res.data)
      }
      setFormModal(null)
      setForm({})
      showToast('Guardado ✓')
    } catch (e: any) {
      showToast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  // ── STATS for history ──
  const ventas = sales.filter(s => s.type !== 'rectificativo')
  const rects  = sales.filter(s => s.type === 'rectificativo')
  const totalV = ventas.reduce((a, b) => a + parseFloat(b.total), 0)
  const totalR = Math.abs(rects.reduce((a, b) => a + parseFloat(b.total), 0))

  // filtered products
  const filteredPrds = products.filter(p =>
    p.active &&
    (activeCat === 0 || p.category_id === activeCat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode && p.barcode.includes(search.trim())))
  )

  // ── PRINT TICKET — optimizado para impresora térmica 80mm ──
  const printTicket = (s: any, auto = false) => {
    const w = window.open('', '_blank', 'width=302,height=600,menubar=no,toolbar=no,location=no,status=no')!
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Ticket ${s.ticket_id}</title>
<style>
  @page {
    size: 80mm auto;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 15px;
    font-weight: 600;
    color: #000;
    background: #fff;
    width: 72mm;
    padding: 4mm 2mm;
  }
  .center { text-align: center; }
  .bold { font-weight: 800; }
  .big { font-size: 18px; font-weight: 800; }
  .small { font-size: 13px; font-weight: 600; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .divider-solid { border-top: 2px solid #000; margin: 4px 0; }
  .total { font-size: 19px; font-weight: 800; }
  .hash { font-size: 9px; color: #444; word-break: break-all; margin-top: 2px; }
  .rect { color: #000; }
</style>
</head><body>
${buildTicketHTML(s)}
</body></html>`)
    w.document.close()
    // Si es impresión automática al cobrar, imprimir y cerrar sin interacción
    if (auto) {
      setTimeout(() => { w.print(); setTimeout(() => w.close(), 500) }, 350)
    } else {
      setTimeout(() => { w.print() }, 350)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: LOGIN
  // ═══════════════════════════════════════════════════════════════
  if (!token || !user) {
    return <LoginScreen onLogin={doLogin} loading={loading} toast={toast} />
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: MOBILE
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <MobileTPV
        token={token!}
        user={user}
        onLogout={doLogout}
      />
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: APP (desktop)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={S.app}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        <img src="/logos/LOGO_OFICIAL_POSITIVO_CORPORATIVO.svg" alt="Logo" style={{ height:28, width:'auto', objectFit:'contain' }} />
        <div style={{ display:'flex', gap:2 }}>
          {(['tpv','history'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit',
              background: view===v ? 'var(--accent)' : 'none',
              color: view===v ? '#fff' : 'var(--text2)',
            }}>
              {v === 'tpv' ? '🧾 Venta' : '📋 Historial'}
            </button>
          ))}
          <button onClick={() => setView('caja')} style={{
            padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit',
            background: view==='caja' ? 'var(--green)' : 'none',
            color: view==='caja' ? '#fff' : 'var(--text2)',
          }}>💰 Caja</button>
          {(user.role === 'admin' || user.role === 'encargado' || user.role === 'cajero') && (
            <button onClick={() => { setAdminTab(user.role === 'cajero' ? 'products' : adminTab); setView('admin') }} style={{
              padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit',
              background: view==='admin' ? 'var(--amber)' : 'none',
              color: view==='admin' ? '#000' : 'var(--text2)',
            }}>{user.role === 'admin' ? '⚙️ Admin' : user.role === 'encargado' ? '🛒 Compras' : '🛒 Compras'}</button>
          )}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--text2)' }}>{clock}</span>
          <span style={{ fontSize:11, color:'var(--text2)', background:'var(--s2)', padding:'4px 10px', borderRadius:6 }}>
            👤 <b style={{ color:'var(--text)' }}>{user.name}</b>{' '}
            <span style={{ ...S.badge(user.role==='admin'?'var(--amber)':user.role==='encargado'?'var(--teal)':'var(--accent)',
              user.role==='admin'?'var(--amber-dim)':user.role==='encargado'?'var(--teal-dim)':'var(--accent-dim)'), fontSize:9 }}>
              {user.role}
            </span>
          </span>
          <button onClick={doLogout} style={{ ...S.btnOutline, fontSize:11 }}>Salir</button>
        </div>
      </div>

      {/* TPV VIEW */}
      {view === 'tpv' && (
        <div style={S.view}>
          {/* Products panel */}
          <div style={S.prdPanel}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0, display:'flex', gap:8 }}>
              <input style={S.input} placeholder="🔍 Buscar producto o escanea código de barras..." value={search} onChange={e => setSearch(e.target.value)} />
              <button onClick={() => { setQuickForm({ name:'', price:'', iva_rate:21, unit_type:'unidad', qty:1 }); setQuickModal(true) }} style={{
                padding:'8px 12px', borderRadius:6, border:'1px solid var(--amber)', background:'var(--amber-dim)',
                color:'var(--amber)', cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit',
                whiteSpace:'nowrap', flexShrink:0,
              }}>🏷️ Artículo rápido</button>
            </div>
            {/* Category bar */}
            <div style={{ display:'flex', gap:6, padding:'8px 14px', overflowX:'auto', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
              <button onClick={() => setActiveCat(0)} style={{
                padding:'4px 12px', borderRadius:20, border:`1px solid ${activeCat===0?'var(--accent)':'var(--border)'}`,
                background: activeCat===0 ? 'var(--accent)' : 'none', color: activeCat===0 ? '#fff' : 'var(--text2)',
                cursor:'pointer', whiteSpace:'nowrap', fontSize:11, fontWeight:500, fontFamily:'inherit',
              }}>🛍️ Todos</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
                  padding:'4px 12px', borderRadius:20, border:`1px solid ${activeCat===c.id?'var(--accent)':'var(--border)'}`,
                  background: activeCat===c.id ? 'var(--accent)' : 'none', color: activeCat===c.id ? '#fff' : 'var(--text2)',
                  cursor:'pointer', whiteSpace:'nowrap', fontSize:11, fontWeight:500, fontFamily:'inherit',
                }}>{c.icon} {c.name}</button>
              ))}
            </div>
            {/* Product grid */}
            <div style={{ flex:1, overflowY:'auto', padding:12, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8, alignContent:'start' }}>
              {filteredPrds.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} style={{
                  background:'var(--s2)', border:'1.5px solid var(--border)', borderRadius:10, padding:'12px 10px',
                  cursor: p.stock>0 ? 'pointer' : 'not-allowed', textAlign:'center',
                  opacity: p.stock===0 ? .35 : 1, transition:'all .15s',
                }}
                  onMouseEnter={e => p.stock>0 && ((e.currentTarget.style.borderColor='var(--accent)'),(e.currentTarget.style.transform='translateY(-2px)'))}
                  onMouseLeave={e => ((e.currentTarget.style.borderColor='var(--border)'),(e.currentTarget.style.transform='none'))}
                >
                  <div style={{ fontSize:26, marginBottom:5 }}>{p.emoji}</div>
                  <div style={{ fontSize:11, fontWeight:600, marginBottom:4, lineHeight:1.3 }}>{p.name}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', fontFamily:'monospace' }}>
                    {fmt(parseFloat(p.price))}{p.unit_type==='kg' ? <span style={{ fontSize:9, color:'var(--text2)' }}>/kg</span> : null}
                  </div>
                  <div style={{ display:'flex', gap:3, justifyContent:'center', flexWrap:'wrap', marginTop:3 }}>
                    <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, fontWeight:600,
                      background: p.regime==='rebu'?'var(--teal-dim)':'var(--accent-dim)',
                      color: p.regime==='rebu'?'var(--teal)':'var(--accent)' }}>
                      {p.regime==='rebu' ? 'REBU' : `IVA ${p.iva_rate}%`}
                    </span>
                    {p.unit_type==='kg' && (
                      <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, fontWeight:600, background:'var(--amber-dim)', color:'var(--amber)' }}>⚖️ kg</span>
                    )}
                  </div>
                  <div style={{ fontSize:10, color: p.stock<5 ? 'var(--amber)' : 'var(--text3)', marginTop:2 }}>
                    {p.unit_type==='kg' ? '⚖️ Venta por peso' : `Stock: ${p.stock}`}
                  </div>
                </div>
              ))}
              {!filteredPrds.length && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text3)', padding:40, fontSize:13 }}>Sin productos</div>
              )}
            </div>
          </div>

          {/* Cart panel */}
          <div style={S.cartPanel}>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>🛒 Carrito</span>
              <span style={{ background:'var(--accent)', color:'#fff', borderRadius:20, padding:'2px 7px', fontSize:11, fontWeight:700 }}>{cart.reduce((a,b)=>a+(b.unit_type==='kg'?1:b.qty),0)}</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:5, minHeight:0 }}>
              {!cart.length
                ? <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', gap:8 }}>
                    <span style={{ fontSize:32 }}>🛍️</span>
                    <p style={{ fontSize:11, textAlign:'center' }}>Carrito vacío.<br/>Selecciona productos.</p>
                  </div>
                : cart.map(i => (
                  <div key={i.id} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:9, display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{i.emoji}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{i.name}</div>
                      <div style={{ fontSize:10, color:'var(--text2)' }}>
                        {i.unit_type==='kg' ? <span style={{ color:'var(--amber)' }}>{i.label}</span> : <>{fmt(i.price)} · <span style={{ color:i.regime==='rebu'?'var(--teal)':'var(--accent)' }}>{i.regime==='rebu'?'REBU':`IVA ${i.iva_rate}%`}</span></>}
                      </div>
                    </div>
                    {i.unit_type === 'kg' ? (
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--amber)', fontFamily:'monospace', minWidth:50, textAlign:'center' }}>
                        {i.qty} kg
                      </span>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <button onClick={() => chgQty(i.id, -1)} style={{ width:20, height:20, borderRadius:4, border:'1px solid var(--border)', background:'var(--s3)', color:'var(--text)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                        <span style={{ fontSize:12, fontWeight:600, minWidth:16, textAlign:'center', fontFamily:'monospace' }}>{i.qty}</span>
                        <button onClick={() => chgQty(i.id, 1)} style={{ width:20, height:20, borderRadius:4, border:'1px solid var(--border)', background:'var(--s3)', color:'var(--text)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                      </div>
                    )}
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--green)', fontFamily:'monospace', flexShrink:0 }}>{fmt(i.price*i.qty)}</span>
                    <button onClick={() => setCart(prev => prev.filter(x => x.id !== i.id))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:12, padding:2 }}>✕</button>
                  </div>
                ))
              }
            </div>
            <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              {/* IVA breakdown */}
              {cart.length > 0 && (
                <div style={{ background:'var(--s2)', borderRadius:6, padding:'7px 9px', marginBottom:8 }}>
                  {[4,10,21].filter(r => groups[String(r)]?.base > 0).map(r => (
                    <div key={r} style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text2)' }}>
                      <span style={{ fontSize:9, background:'var(--s3)', padding:'1px 4px', borderRadius:3, color:'var(--text3)', fontWeight:600 }}>IVA {r}%</span>
                      <span>Base: {fmt(groups[String(r)].base)}</span>
                      <span>Cuota: {fmt(groups[String(r)].iva)}</span>
                    </div>
                  ))}
                  {groups.rebu?.total > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text2)' }}>
                      <span style={{ fontSize:9, background:'var(--s3)', padding:'1px 4px', borderRadius:3, color:'var(--teal)', fontWeight:600 }}>REBU</span>
                      <span>Margen: {fmt(groups.rebu.margin)}</span>
                      <span>IVA/m: {fmt(groups.rebu.iva)}</span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginBottom:10, display:'flex', flexDirection:'column', gap:3 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text2)' }}><span>Base imponible</span><span>{fmt(base)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text2)' }}><span>IVA total</span><span>{fmt(ivaTotal)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:700, marginTop:6, paddingTop:6, borderTop:'1px solid var(--border)' }}>
                  <span>TOTAL</span><span style={{ color:'var(--green)', fontFamily:'monospace' }}>{fmt(total)}</span>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:7 }}>
                {(['efectivo','tarjeta'] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)} style={{
                    padding:9, borderRadius:6, border:`1px solid ${payMethod===m?'var(--accent)':'var(--border)'}`,
                    background: payMethod===m ? 'var(--accent-dim)' : 'var(--s2)',
                    color: payMethod===m ? 'var(--accent)' : 'var(--text)', cursor:'pointer',
                    fontSize:11, fontWeight:500, fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                  }}>
                    <span style={{ fontSize:14 }}>{m==='efectivo'?'💵':'💳'}</span>
                    {m==='efectivo'?'Efectivo':'Tarjeta'}
                  </button>
                ))}
              </div>
              {/* Cambio efectivo */}
              {payMethod === 'efectivo' && cart.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:4 }}>
                    Efectivo entregado
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' as const }}>
                    {[Math.ceil(total), Math.ceil(total/5)*5, Math.ceil(total/10)*10, Math.ceil(total/20)*20, Math.ceil(total/50)*50].filter((v,i,a)=>a.indexOf(v)===i&&v>=total).slice(0,4).map(v => (
                      <button key={v} onClick={() => setEfectivoEntregado(String(v))} style={{
                        padding:'4px 10px', borderRadius:6, border:`1px solid ${efectivoEntregado===String(v)?'var(--accent)':'var(--border)'}`,
                        background: efectivoEntregado===String(v)?'var(--accent-dim)':'var(--s2)',
                        color: efectivoEntregado===String(v)?'var(--accent)':'var(--text2)',
                        cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit',
                      }}>{v % 1 === 0 ? v : v.toFixed(2)} €</button>
                    ))}
                  </div>
                  <input
                    style={{ ...S.input, textAlign:'center' as const, fontSize:16, fontWeight:700, fontFamily:'monospace' }}
                    type="number" step="0.01" min="0"
                    value={efectivoEntregado}
                    onChange={e => setEfectivoEntregado(e.target.value)}
                    placeholder={`Mín. ${fmt(total)}`}
                  />
                  {efectivoEntregado && parseFloat(efectivoEntregado) >= total && (
                    <div style={{ marginTop:6, padding:'8px 12px', borderRadius:8, background:'var(--green-dim)', border:'1px solid rgba(62,207,142,.3)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'var(--text2)' }}>💰 Cambio</span>
                      <span style={{ fontSize:20, fontWeight:700, color:'var(--green)', fontFamily:'monospace' }}>
                        {fmt(Math.round((parseFloat(efectivoEntregado) - total) * 100) / 100)}
                      </span>
                    </div>
                  )}
                  {efectivoEntregado && parseFloat(efectivoEntregado) < total && (
                    <div style={{ marginTop:6, padding:'6px 10px', borderRadius:6, background:'var(--red-dim)', fontSize:11, color:'var(--red)', fontWeight:600 }}>
                      ⚠️ Faltan {fmt(Math.round((total - parseFloat(efectivoEntregado)) * 100) / 100)}
                    </div>
                  )}
                </div>
              )}
              <button onClick={checkout} disabled={!cart.length || loading || (user.role === 'cajero' && cajaChecked && !openCaja)} style={{
                width:'100%', padding:11, borderRadius:8, border:'none',
                background: cart.length ? 'var(--green)' : 'var(--s3)',
                color: cart.length ? '#fff' : 'var(--text3)',
                cursor: cart.length ? 'pointer' : 'not-allowed',
                fontSize:14, fontWeight:700, fontFamily:'inherit',
              }}>
                {loading ? '...' : (user.role === 'cajero' && cajaChecked && !openCaja) ? '🔴 Abre la caja primero' : cart.length ? `Cobrar ${fmt(total)}` : 'Cobrar'}
              </button>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} style={{ ...S.btnOutline, width:'100%', marginTop:5, fontSize:11 }}>Vaciar carrito</button>
              )}
              {/* Cerrar caja button */}
              {openCaja && (
                <button onClick={() => { setRealContado(''); setNotasCierre(''); setCierreModal(true) }} style={{
                  width:'100%', marginTop:8, padding:'8px', borderRadius:8, border:'1px solid var(--red)',
                  background:'none', color:'var(--red)', cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit',
                }}>🔴 Cerrar caja</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY VIEW */}
      {view === 'history' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
            <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>📋 Historial de Ventas</span>
            <input style={{ ...S.input, width:150 }} placeholder="Buscar ticket..." value={histSearch} onChange={e => setHistSearch(e.target.value)} />
            {[['payFilter','','Todos','Efectivo',['','efectivo','tarjeta'],['Todos','Efectivo','Tarjeta']],
              ['typeFilter','','Todos los tipos','',['','venta','rectificativo'],['Todos','Ventas','Rectificativos']]
            ].map(([key, , , , vals, labels]: any) => (
              <select key={key} value={key==='payFilter'?payFilter:typeFilter}
                onChange={e => key==='payFilter' ? setPayFilter(e.target.value) : setTypeFilter(e.target.value)}
                style={{ ...S.input, width:'auto', cursor:'pointer' }}>
                {(vals as string[]).map((v: string, i: number) => <option key={v} value={v}>{(labels as string[])[i]}</option>)}
              </select>
            ))}
            <button onClick={loadSales} style={{ ...S.btn(), padding:'6px 11px', fontSize:11 }}>🔄 Actualizar</button>
            <button onClick={() => doExport('csv')} style={{ ...S.btnOutline, fontSize:11 }}>📊 CSV</button>
            <button onClick={() => doExport('json')} style={{ ...S.btnOutline, fontSize:11 }}>💾 JSON</button>
          </div>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:9, padding:'12px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            {[
              ['Ventas', ventas.length, 'var(--accent)', 'tickets'],
              ['Facturado', fmt(totalV), 'var(--green)', 'bruto c/IVA'],
              ['Rectificativos', `${rects.length} (−${fmt(totalR)})`, 'var(--red)', 'devoluciones'],
              ['Neto', fmt(totalV - totalR), 'var(--green)', 'real c/IVA'],
            ].map(([label, val, color, sub]) => (
              <div key={label as string} style={S.card}>
                <div style={{ fontSize:10, color:'var(--text2)', marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:17, fontWeight:700, fontFamily:'monospace', color: color as string }}>{val}</div>
                <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{sub}</div>
              </div>
            ))}
          </div>
          {/* Table */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 20px', minHeight:0 }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Ticket','Fecha/Hora','Cajero','Pago','Base + IVA','Total','Estado','🔒','Acciones'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!sales.length && (
                  <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Sin registros</td></tr>
                )}
                {sales.map(s => {
                  const isRect = s.type === 'rectificativo'
                  const canRect = (user.role === 'encargado' || user.role === 'admin') && !isRect && !s.rectified
                  return (
                    <tr key={s.id} style={{ opacity: isRect ? .7 : 1, cursor:'pointer' }}
                      onClick={() => setTicketModal(s)}
                      onMouseEnter={e => (e.currentTarget.style.background='var(--s2)')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      <td style={S.td}><span style={{ ...S.badge('var(--text2)','var(--s3)'), fontFamily:'monospace' }}>{s.ticket_id}</span></td>
                      <td style={S.td}>{s.date} <span style={{ color:'var(--text2)' }}>{s.time}</span></td>
                      <td style={{ ...S.td, fontSize:11 }}>{s.cashier_name}</td>
                      <td style={S.td}><span style={s.pay==='efectivo' ? S.badge('var(--green)','var(--green-dim)') : S.badge('var(--accent)','var(--accent-dim)')}>{s.pay==='efectivo'?'💵 Efect.':'💳 Tarjeta'}</span></td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:10 }}>{fmtN(Math.abs(s.base))} + {fmtN(Math.abs(s.iva_total))}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color: isRect?'var(--red)':'var(--green)' }}>{isRect?'−':''}{fmtN(Math.abs(s.total))} €</td>
                      <td style={S.td}>
                        {isRect ? <span style={S.badge('var(--red)','var(--red-dim)')}>↩️ Rectif.</span>
                          : s.rectified ? <span style={{ ...S.badge('var(--red)','var(--red-dim)'), fontSize:9 }}>Rectificado</span>
                          : <span style={S.badge('var(--green)','var(--green-dim)')}>✓ OK</span>}
                      </td>
                      <td style={S.td}>{s.hash ? '🔒' : '⚠️'}</td>
                      <td style={S.td}>
                        <button onClick={() => setTicketModal(s)} style={{ ...S.btnOutline, fontSize:10 }}>Ver</button>
                        {canRect && (
                          <button onClick={() => { setRectModal(s); setRectReason('') }} style={{ ...S.btnOutline, fontSize:10, marginLeft:4, color:'var(--red)', borderColor:'var(--red-dim)' }}>↩️ Rectificar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CAJA VIEW */}
      {view === 'caja' && (
        <div style={S.view}>
          <CashRegister token={token!} user={user} onCajaChange={loadCaja} />
        </div>
      )}

      {/* ADMIN VIEW */}
      {view === 'admin' && (
        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
          {/* Sidebar */}
          <div style={{ width:190, flexShrink:0, background:'var(--s1)', borderRight:'1px solid var(--border)', padding:'12px 8px', display:'flex', flexDirection:'column', gap:2 }}>
            {([
              ['products','📦','Productos'],
              ['categories','🏷️','Categorías'],
              ['users','👥','Usuarios'],
              ['log','📜','Log operaciones'],
              ['compras','🛒','Compras'],
              ['informes','📊','Informes'],
            ] as [typeof adminTab, string, string][]).filter(([tab]) => {
              if (user.role === 'cajero') return ['products', 'compras'].includes(tab)
              if (user.role === 'encargado') return ['products','compras','informes'].includes(tab)
              return true // admin sees all
            }).map(([tab, icon, label]) => (
              <button key={tab} onClick={() => setAdminTab(tab)} style={{
                width:'100%', padding:'8px 12px', borderRadius:6, border:'none',
                background: adminTab===tab ? 'var(--amber-dim)' : 'none',
                color: adminTab===tab ? 'var(--amber)' : 'var(--text2)',
                cursor:'pointer', textAlign:'left', fontSize:12, fontWeight:500, fontFamily:'inherit',
                display:'flex', alignItems:'center', gap:8,
              }}><span>{icon}</span>{label}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>

            {/* Products tab */}
            {adminTab === 'products' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', flexShrink:0 }}>
                  <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>📦 Productos</span>
                  <button onClick={() => { setForm({ emoji:'📦', regime:'iva', iva_rate:21, stock:0, active:true }); setFormModal({ type:'product' }) }} style={S.btn('var(--amber)')}>+ Añadir</button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
                  <table style={S.table}>
                    <thead><tr>{['','Nombre','Categoría','Precio','Régimen','Stock','Estado','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id} onMouseEnter={e => (e.currentTarget.style.background='var(--s2)')} onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                          <td style={S.td}><span style={{ fontSize:18 }}>{p.emoji}</span></td>
                          <td style={{ ...S.td, fontWeight:600 }}>
                            {p.name}
                            {p.barcode && <div style={{ fontSize:9, color:'var(--text3)', fontFamily:'monospace', marginTop:1 }}>🔢 {p.barcode}</div>}
                          </td>
                          <td style={S.td}>{categories.find(c=>c.id===p.category_id)?.name || '-'}</td>
                          <td style={{ ...S.td, fontFamily:'monospace' }}>{fmt(parseFloat(p.price))}</td>
                          <td style={S.td}><span style={{ ...S.badge(p.regime==='rebu'?'var(--teal)':'var(--accent)', p.regime==='rebu'?'var(--teal-dim)':'var(--accent-dim)'), fontSize:10 }}>{p.regime==='rebu'?'REBU':`IVA ${p.iva_rate}%`}</span></td>
                          <td style={S.td}><span style={{ ...S.badge(p.stock===0?'var(--red)':p.stock<5?'var(--amber)':'var(--green)', p.stock===0?'var(--red-dim)':p.stock<5?'var(--amber-dim)':'var(--green-dim)'), fontFamily:'monospace' }}>{p.stock}</span></td>
                          <td style={S.td}><span style={{ ...S.badge(p.active?'var(--green)':'var(--text3)', p.active?'var(--green-dim)':'var(--s3)') }}>{p.active?'Activo':'Inact.'}</span></td>
                          <td style={S.td}>
                            <button onClick={() => { setForm({...p}); setFormModal({ type:'product', data:p }) }} style={{ ...S.btnOutline, fontSize:10, color:'var(--accent)', borderColor:'var(--accent-dim)', marginRight:4 }}>Editar</button>
                            <button onClick={() => { if(confirm('¿Eliminar?')) api.products.delete(token!, p.id).then(loadProducts).catch(e => showToast(e.message,'err')) }} style={{ ...S.btnOutline, fontSize:10, color:'var(--red)', borderColor:'var(--red-dim)' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Categories tab */}
            {adminTab === 'categories' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', flexShrink:0 }}>
                  <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>🏷️ Categorías</span>
                  <button onClick={() => { setForm({ icon:'🏷️' }); setFormModal({ type:'category' }) }} style={S.btn('var(--amber)')}>+ Añadir</button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, alignContent:'start' }}>
                  {categories.map(c => (
                    <div key={c.id} style={{ ...S.card, display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:22 }}>{c.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                        <div style={{ fontSize:10, color:'var(--text2)' }}>{products.filter(p=>p.category_id===c.id).length} productos</div>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => { setForm({...c}); setFormModal({ type:'category', data:c }) }} style={{ ...S.btnOutline, fontSize:10, color:'var(--accent)' }}>✏️</button>
                        <button onClick={() => { if(confirm('¿Eliminar?')) api.categories.delete(token!, c.id).then(loadProducts).catch(e => showToast(e.message,'err')) }} style={{ ...S.btnOutline, fontSize:10, color:'var(--red)' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users tab */}
            {adminTab === 'users' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', flexShrink:0 }}>
                  <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>👥 Usuarios</span>
                  <button onClick={() => { setForm({ role:'cajero' }); setFormModal({ type:'user' }) }} style={S.btn('var(--amber)')}>+ Añadir</button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
                  <table style={S.table}>
                    <thead><tr>{['Usuario','Nombre','Rol','Último acceso','Estado','Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {adminUsers.map(u => (
                        <tr key={u.id} onMouseEnter={e => (e.currentTarget.style.background='var(--s2)')} onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                          <td style={{ ...S.td, fontFamily:'monospace', fontSize:12 }}>{u.username}</td>
                          <td style={{ ...S.td, fontWeight:600 }}>{u.name}</td>
                          <td style={S.td}><span style={S.badge(u.role==='admin'?'var(--amber)':u.role==='encargado'?'var(--teal)':'var(--accent)', u.role==='admin'?'var(--amber-dim)':u.role==='encargado'?'var(--teal-dim)':'var(--accent-dim)')}>{u.role}</span></td>
                          <td style={{ ...S.td, fontSize:11, color:'var(--text2)' }}>{u.last_login ? new Date(u.last_login).toLocaleString('es-ES') : 'Nunca'}</td>
                          <td style={S.td}><span style={S.badge(u.active?'var(--green)':'var(--red)', u.active?'var(--green-dim)':'var(--red-dim)')}>{u.active?'Activo':'Inact.'}</span></td>
                          <td style={S.td}>
                            <button onClick={() => { setForm({...u, password:''}); setFormModal({ type:'user', data:u }) }} style={{ ...S.btnOutline, fontSize:10, color:'var(--accent)', borderColor:'var(--accent-dim)' }}>Editar</button>
                            {u.id !== user.id && <button onClick={() => { if(confirm('¿Desactivar?')) api.users.delete(token!, u.id).then(() => loadAdminTab('users')).catch(e => showToast(e.message,'err')) }} style={{ ...S.btnOutline, fontSize:10, color:'var(--red)', borderColor:'var(--red-dim)', marginLeft:4 }}>Desact.</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ ...S.card, marginTop:16, fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>
                    <span style={{ color:'var(--amber)', fontWeight:700 }}>Roles:</span>{' '}
                    🟣 <b>Cajero</b> — solo ventas &nbsp;|&nbsp;
                    🟢 <b>Encargado</b> — ventas + rectificativos &nbsp;|&nbsp;
                    🟡 <b>Admin</b> — acceso total
                  </div>
                </div>
              </div>
            )}

            {/* Log tab */}
            {adminTab === 'log' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
                <div style={{ fontSize:48 }}>🔧</div>
                <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>Próximamente</div>
                <div style={{ fontSize:13, color:'var(--text2)', textAlign:'center' as const, maxWidth:340, lineHeight:1.6 }}>
                  El log de operaciones está en mantenimiento.<br/>Estará disponible en la próxima actualización.
                </div>
              </div>
            )}

            {/* Integrity tab */}
            {adminTab === 'compras' && (
              <PurchasesModule token={token!} categories={categories} />
            )}

            {adminTab === 'informes' && (
              <ReportsModule token={token!} categories={categories} users={adminUsers} />
            )}

          </div>
        </div>
      )}

      {/* ── TICKET MODAL ── */}
      {ticketModal && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setTicketModal(null) }}>
          <div style={{ ...S.modalBox, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>{ticketModal.type==='rectificativo'?'↩️':'✅'}</div>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>{ticketModal.type==='rectificativo'?'Ticket Rectificativo':'¡Venta completada!'}</h3>
            <p style={{ color:'var(--text2)', fontSize:11, marginBottom:16 }}>{ticketModal.ticket_id} · {ticketModal.date} {ticketModal.time}</p>
            <div style={{ background:'var(--s2)', borderRadius:10, padding:14, marginBottom:16, textAlign:'left' }}
              dangerouslySetInnerHTML={{ __html: buildTicketHTML(ticketModal) }} />
            <div style={{ display:'flex', gap:7 }}>
              <button onClick={() => setTicketModal(null)} style={{ ...S.btnOutline, flex:1 }}>Cerrar</button>
              <button onClick={() => printTicket(ticketModal)} style={{ ...S.btn(), flex:1 }}>🖨️ Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECTIFY MODAL ── */}
      {rectModal && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setRectModal(null) }}>
          <div style={{ ...S.modalBox }}>
            <div style={{ fontSize:40, marginBottom:10, textAlign:'center' }}>↩️</div>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>Emitir Ticket Rectificativo</h3>
            <p style={{ color:'var(--text2)', fontSize:11, marginBottom:14 }}>Ticket {rectModal.ticket_id} · {rectModal.date} · {fmt(parseFloat(rectModal.total))}</p>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:6 }}>Motivo de rectificación (obligatorio):</div>
            <textarea value={rectReason} onChange={e => setRectReason(e.target.value)}
              placeholder="Ej: Error en precio, devolución de producto..."
              style={{ ...S.input, resize:'vertical', minHeight:70, marginBottom:8 }} />
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:16 }}>El ticket original quedará anulado y se generará un rectificativo con referencia. Ambos quedan en el historial.</div>
            <div style={{ display:'flex', gap:7 }}>
              <button onClick={() => setRectModal(null)} style={{ ...S.btnOutline, flex:1 }}>Cancelar</button>
              <button onClick={confirmRect} disabled={!rectReason.trim() || loading} style={{ ...S.btn('var(--red)'), flex:1, opacity: !rectReason.trim() ? .5 : 1 }}>↩️ Emitir rectificativo</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {formModal && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setFormModal(null) }}>
          <div style={S.modalBox}>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:18 }}>
              {formModal.data ? '✏️ Editar' : '➕ Nuevo'} {formModal.type === 'product' ? 'Producto' : formModal.type === 'category' ? 'Categoría' : 'Usuario'}
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {formModal.type === 'product' && <>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Nombre</label>
                  <input style={S.input} value={form.name||''} onChange={e => setForm({...form, name:e.target.value})} placeholder="Nombre del producto" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Código de barras (opcional)</label>
                  <input style={S.input} value={form.barcode||''} onChange={e => setForm({...form, barcode:e.target.value})}
                    placeholder="Escanea o escribe el código EAN/UPC..." />
                </div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Emoji</label>
                  <input style={S.input} value={form.emoji||'📦'} onChange={e => setForm({...form, emoji:e.target.value})} maxLength={4} /></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Categoría</label>
                  <select style={S.input} value={form.category_id||''} onChange={e => setForm({...form, category_id:parseInt(e.target.value)})}>
                    <option value="">Seleccionar</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select></div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Unidad de venta</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {[['unidad','📦 Por unidad','Precio fijo por artículo'],['kg','⚖️ Por kilogramo','El cajero introduce el peso al vender']].map(([val,label,desc]) => (
                      <div key={val} onClick={() => setForm({...form, unit_type: val})} style={{
                        flex:1, padding:'8px 10px', borderRadius:8, cursor:'pointer',
                        border: `1.5px solid ${(form.unit_type||'unidad')===val ? 'var(--accent)' : 'var(--border)'}`,
                        background: (form.unit_type||'unidad')===val ? 'var(--accent-dim)' : 'var(--s2)',
                      }}>
                        <div style={{ fontSize:12, fontWeight:700, color:(form.unit_type||'unidad')===val?'var(--accent)':'var(--text)', marginBottom:2 }}>{label}</div>
                        <div style={{ fontSize:10, color:'var(--text2)' }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>
                  {(form.unit_type||'unidad')==='kg' ? 'Precio (€/kg)' : 'Precio venta (€)'}
                </label>
                  <input style={S.input} type="number" step="0.01" min="0" value={form.price||0} onChange={e => setForm({...form, price:parseFloat(e.target.value)})} /></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Stock</label>
                  <input style={S.input} type="number" min="0" value={form.stock||0} onChange={e => setForm({...form, stock:parseInt(e.target.value)})} /></div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Régimen fiscal</label>
                  <div style={{ display:'flex', gap:5 }}>
                    {[['iva4','IVA 4%',4],['iva10','IVA 10%',10],['iva21','IVA 21%',21],['rebu','REBU',21]].map(([key,label,rate]) => (
                      <button key={key as string} type="button" onClick={() => setForm({...form, regime: (key as string).startsWith('rebu')?'rebu':'iva', iva_rate:rate})} style={{
                        flex:1, padding:'6px 4px', borderRadius:6, fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
                        border: `1px solid ${(form.regime===(key==='rebu'?'rebu':'iva') && (key==='rebu' ? true : form.iva_rate===rate))?'var(--accent)':'var(--border)'}`,
                        background: (form.regime===(key==='rebu'?'rebu':'iva') && (key==='rebu' ? true : form.iva_rate===rate)) ? 'var(--accent-dim)' : 'var(--s2)',
                        color: (form.regime===(key==='rebu'?'rebu':'iva') && (key==='rebu' ? true : form.iva_rate===rate)) ? 'var(--accent)' : 'var(--text2)',
                      }}>{label as string}</button>
                    ))}
                  </div>
                </div>
                {form.regime === 'rebu' && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Precio de coste (€) — para cálculo margen REBU</label>
                    <input style={S.input} type="number" step="0.01" min="0" value={form.cost_price||0} onChange={e => setForm({...form, cost_price:parseFloat(e.target.value)})} />
                  </div>
                )}
              </>}

              {formModal.type === 'category' && <>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:4 }}>EMOJI</label>
                  <input style={S.input} value={form.icon||'🏷️'} onChange={e => setForm({...form, icon:e.target.value})} maxLength={4} /></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:4 }}>NOMBRE</label>
                  <input style={S.input} value={form.name||''} onChange={e => setForm({...form, name:e.target.value})} placeholder="Nombre categoría" /></div>
              </>}

              {formModal.type === 'user' && <>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:4 }}>USUARIO</label>
                  <input style={S.input} value={form.username||''} onChange={e => setForm({...form, username:e.target.value})} placeholder="cajero3" readOnly={!!formModal.data} /></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:4 }}>NOMBRE COMPLETO</label>
                  <input style={S.input} value={form.name||''} onChange={e => setForm({...form, name:e.target.value})} placeholder="Juan López" /></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:4 }}>CONTRASEÑA {formModal.data && '(vacío = no cambiar)'}</label>
                  <input style={S.input} type="password" value={form.password||''} onChange={e => setForm({...form, password:e.target.value})} placeholder="••••••" /></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, display:'block', marginBottom:4 }}>ROL</label>
                  <select style={S.input} value={form.role||'cajero'} onChange={e => setForm({...form, role:e.target.value})}>
                    <option value="cajero">🟣 Cajero — solo ventas</option>
                    <option value="encargado">🟢 Encargado — ventas + rectificativos</option>
                    <option value="admin">🟡 Administrador — acceso total</option>
                  </select></div>
              </>}
            </div>
            <div style={{ display:'flex', gap:7, marginTop:18, justifyContent:'flex-end' }}>
              <button onClick={() => setFormModal(null)} style={S.btnOutline}>Cancelar</button>
              <button onClick={saveForm} disabled={loading} style={S.btn('var(--amber)')}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RGPD MODAL ── */}
      {rgpdModal && (
        <div style={S.modal} onClick={e => { if(e.target===e.currentTarget) setRgpdModal(false) }}>
          <div style={{ ...S.modalBox, width:520 }}>
            <h3 style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>🛡️ Política de Privacidad</h3>
            <p style={{ color:'var(--text2)', fontSize:11, marginBottom:16 }}>Conforme al RGPD (UE) 2016/679 y LOPDGDD</p>
            <div style={{ maxHeight:400, overflowY:'auto', fontSize:12, color:'var(--text2)', lineHeight:1.8, paddingRight:6 }}>
              <b style={{ color:'var(--text)' }}>Responsable:</b> {NEGOCIO.nombre}, NIF {NEGOCIO.nif}, {NEGOCIO.direccion}, {NEGOCIO.cp} {NEGOCIO.localidad}. Email: {NEGOCIO.email}<br/><br/>
              <b style={{ color:'var(--text)' }}>Finalidad:</b> Gestión de ventas, control de inventario y cumplimiento de obligaciones fiscales (Ley 58/2003 General Tributaria, Código de Comercio).<br/><br/>
              <b style={{ color:'var(--text)' }}>Base jurídica:</b> Obligación legal (Art. 6.1.c RGPD). Interés legítimo para la gestión del negocio.<br/><br/>
              <b style={{ color:'var(--text)' }}>Datos tratados:</b> Tickets de venta, importes, métodos de pago, nombre de cajero. No se almacenan datos de tarjetas bancarias ni datos personales de clientes.<br/><br/>
              <b style={{ color:'var(--text)' }}>Conservación:</b> 6 años (Art. 30 Código de Comercio) / mínimo 4 años (Art. 66-68 LGT).<br/><br/>
              <b style={{ color:'var(--text)' }}>Derechos:</b> Acceso, rectificación, supresión, oposición, limitación y portabilidad. Contacto: {NEGOCIO.email}. Reclamación ante AEPD (www.aepd.es).<br/><br/>
              <b style={{ color:'var(--text)' }}>Seguridad:</b> Contraseñas hasheadas con bcrypt. Hash encadenado SHA-256 por ticket. Control de acceso por roles. Datos en Supabase (UE).
            </div>
            <button onClick={() => setRgpdModal(false)} style={{ ...S.btn('var(--amber)'), width:'100%', marginTop:16 }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── BARCODE TOAST ── */}
      {barcodeToast && (
        <div style={{ position:'fixed', top:70, left:'50%', transform:'translateX(-50%)', zIndex:800,
          background: barcodeToast.startsWith('✓') ? 'var(--green)' : 'var(--amber)',
          color:'#fff', padding:'10px 24px', borderRadius:30, fontSize:14, fontWeight:700,
          boxShadow:'0 4px 20px rgba(0,0,0,.2)', whiteSpace:'nowrap' }}>
          {barcodeToast}
        </div>
      )}

      {/* ── ARTÍCULO RÁPIDO MODAL ── */}
      {quickModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,29,46,.65)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
          onClick={e => { if(e.target===e.currentTarget) setQuickModal(false) }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:380, boxShadow:'0 8px 32px rgba(89,122,166,.2)' }}>
            <div style={{ fontSize:32, textAlign:'center' as const, marginBottom:8 }}>🏷️</div>
            <div style={{ fontSize:16, fontWeight:700, textAlign:'center' as const, marginBottom:4 }}>Artículo rápido</div>
            <div style={{ fontSize:12, color:'var(--text2)', textAlign:'center' as const, marginBottom:20 }}>
              Se añade al carrito sin guardarse en el catálogo
            </div>

            <div style={{ display:'flex', flexDirection:'column' as const, gap:12 }}>
              {/* Nombre */}
              <div>
                <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:5 }}>Descripción *</label>
                <input style={S.input} value={quickForm.name} onChange={e => setQuickForm(f => ({...f, name:e.target.value}))}
                  placeholder="Ej: Servicio, Descuento, Producto sin código..." autoFocus
                  onKeyDown={e => e.key === 'Enter' && (document.getElementById('qf-price') as HTMLInputElement)?.focus()} />
              </div>

              {/* Unidad */}
              <div>
                <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:5 }}>Tipo</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {([['unidad','📦 Unidad'],['kg','⚖️ Por kg']] as [string,string][]).map(([val,label]) => (
                    <button key={val} type="button" onClick={() => setQuickForm(f => ({...f, unit_type:val, qty:val==='kg'?1:1}))}
                      style={{ padding:'8px', borderRadius:8, border:`1.5px solid ${quickForm.unit_type===val?'var(--amber)':'var(--border)'}`,
                        background: quickForm.unit_type===val?'var(--amber-dim)':'var(--s2)',
                        color: quickForm.unit_type===val?'var(--amber)':'var(--text2)',
                        cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Precio y cantidad */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:5 }}>
                    {quickForm.unit_type==='kg' ? 'Precio (€/kg)' : 'Precio (€)'} *
                  </label>
                  <input id="qf-price" style={{ ...S.input, fontSize:18, fontWeight:700, fontFamily:'monospace', textAlign:'center' as const }}
                    type="number" step="0.01" min="0"
                    value={quickForm.price} onChange={e => setQuickForm(f => ({...f, price:e.target.value}))}
                    placeholder="0.00"
                    onKeyDown={e => e.key === 'Enter' && addQuickItem()} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:5 }}>
                    {quickForm.unit_type==='kg' ? 'Peso (kg)' : 'Cantidad'}
                  </label>
                  <input style={{ ...S.input, textAlign:'center' as const, fontSize:16, fontWeight:700 }}
                    type="number" step={quickForm.unit_type==='kg'?'0.001':'1'} min={quickForm.unit_type==='kg'?'0.001':'1'}
                    value={quickForm.qty} onChange={e => setQuickForm(f => ({...f, qty:parseFloat(e.target.value)||1}))}
                    onKeyDown={e => e.key === 'Enter' && addQuickItem()} />
                </div>
              </div>

              {/* IVA */}
              <div>
                <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:5 }}>IVA</label>
                <div style={{ display:'flex', gap:5 }}>
                  {([4,10,21] as number[]).map(r => (
                    <button key={r} type="button" onClick={() => setQuickForm(f => ({...f, iva_rate:r}))}
                      style={{ flex:1, padding:'7px 4px', borderRadius:6, border:`1px solid ${quickForm.iva_rate===r?'var(--accent)':'var(--border)'}`,
                        background: quickForm.iva_rate===r?'var(--accent-dim)':'var(--s2)',
                        color: quickForm.iva_rate===r?'var(--accent)':'var(--text2)',
                        cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'inherit' }}>
                      {r}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview total */}
              {quickForm.price && parseFloat(quickForm.price) > 0 && (
                <div style={{ background:'var(--s2)', borderRadius:8, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'var(--text2)' }}>
                    {quickForm.unit_type==='kg'
                      ? `${quickForm.qty} kg × ${parseFloat(quickForm.price).toFixed(2).replace('.',',')} €/kg`
                      : `${quickForm.qty} × ${parseFloat(quickForm.price).toFixed(2).replace('.',',')} €`}
                  </span>
                  <span style={{ fontSize:18, fontWeight:700, color:'var(--green)', fontFamily:'monospace' }}>
                    {((quickForm.unit_type==='kg' ? quickForm.qty * parseFloat(quickForm.price) : quickForm.qty * parseFloat(quickForm.price)) || 0).toFixed(2).replace('.',',')} €
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button onClick={() => setQuickModal(false)} style={{ ...S.btnOutline, flex:1 }}>Cancelar</button>
                <button onClick={addQuickItem} disabled={!quickForm.name || !quickForm.price || parseFloat(quickForm.price) <= 0} style={{
                  flex:2, padding:12, borderRadius:8, border:'none',
                  background: (quickForm.name && quickForm.price) ? 'var(--green)' : 'var(--s3)',
                  color: (quickForm.name && quickForm.price) ? '#fff' : 'var(--text3)',
                  cursor: (quickForm.name && quickForm.price) ? 'pointer' : 'not-allowed',
                  fontSize:14, fontWeight:700, fontFamily:'inherit',
                }}>
                  ➕ Añadir al carrito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PESO MODAL — para artículos vendidos por kg ── */}
      {pesoModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,29,46,.65)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
          onClick={e => { if(e.target===e.currentTarget){ setPesoModal(null); setPesoKg('') } }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:340, boxShadow:'0 8px 32px rgba(89,122,166,.2)', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>⚖️</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:2 }}>{pesoModal.emoji} {pesoModal.name}</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:20 }}>
              Precio: {fmt(parseFloat(pesoModal.price))} / kg
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:8 }}>
                Introduce el peso (kg)
              </label>
              <input
                style={{ ...S.input, fontSize:32, fontWeight:700, textAlign:'center' as const, fontFamily:'monospace', padding:'14px', letterSpacing:'.05em' }}
                type="number" step="0.001" min="0.001"
                value={pesoKg}
                onChange={e => setPesoKg(e.target.value)}
                placeholder="0.000"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && confirmPeso()}
              />
            </div>
            {pesoKg && parseFloat(pesoKg.replace(',','.')) > 0 && (
              <div style={{ background:'var(--s2)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
                <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text2)', marginBottom:4 }}>
                  <span>{pesoKg} kg × {fmt(parseFloat(pesoModal.price))}/kg</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:700 }}>
                  <span>Total</span>
                  <span style={{ color:'var(--green)', fontFamily:'monospace' }}>
                    {fmt(Math.round(parseFloat(pesoKg.replace(',','.')) * parseFloat(pesoModal.price) * 100) / 100)}
                  </span>
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setPesoModal(null); setPesoKg('') }} style={{ ...S.btnOutline, flex:1 }}>Cancelar</button>
              <button onClick={confirmPeso} disabled={!pesoKg || parseFloat(pesoKg.replace(',','.')) <= 0} style={{
                flex:2, padding:12, borderRadius:8, border:'none',
                background: pesoKg ? 'var(--green)' : 'var(--s3)',
                color: pesoKg ? '#fff' : 'var(--text3)',
                cursor: pesoKg ? 'pointer' : 'not-allowed',
                fontSize:14, fontWeight:700, fontFamily:'inherit',
              }}>
                ➕ Añadir al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── APERTURA CAJA — FULLSCREEN MODAL ── */}
      {token && user && sessionReady && cajaChecked && !openCaja && !isMobile && user.role === 'cajero' && (
        <div style={{ position:'fixed', inset:0, zIndex:800, background:'rgba(245,247,251,.97)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:20, padding:40, width:440, boxShadow:'0 8px 48px rgba(89,122,166,.2)', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏪</div>
            <div style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Apertura de Caja</div>
            <div style={{ color:'var(--text2)', fontSize:13, marginBottom:28 }}>
              {new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </div>
            <div style={{ textAlign:'left', marginBottom:16 }}>
              <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:8 }}>💵 Billetes</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, marginBottom:10 }}>
                {DENOM.filter(d => d.type === 'billete').map(d => (
                  <div key={d.value} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 4px', textAlign:'center' as const }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--amber)', marginBottom:3 }}>{d.label}</div>
                    <input
                      style={{ width:'100%', background:'var(--s1)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 2px', color:'var(--text)', fontFamily:'monospace', fontSize:13, fontWeight:700, textAlign:'center' as const, outline:'none' }}
                      type="number" min="0" step="1"
                      value={apCounts[String(d.value)] || ''}
                      onChange={e => setApCounts(p => ({ ...p, [String(d.value)]: e.target.value }))}
                      placeholder="0"
                    />
                    {(parseFloat(apCounts[String(d.value)] || '0') || 0) > 0 && (
                      <div style={{ fontSize:9, color:'var(--green)', marginTop:2, fontFamily:'monospace' }}>
                        {((parseFloat(apCounts[String(d.value)] || '0') || 0) * d.value).toFixed(2).replace('.',',')} €
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:8 }}>🪙 Monedas</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, marginBottom:12 }}>
                {DENOM.filter(d => d.type === 'moneda').map(d => (
                  <div key={d.value} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 4px', textAlign:'center' as const }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--teal)', marginBottom:3 }}>{d.label}</div>
                    <input
                      style={{ width:'100%', background:'var(--s1)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 2px', color:'var(--text)', fontFamily:'monospace', fontSize:13, fontWeight:700, textAlign:'center' as const, outline:'none' }}
                      type="number" min="0" step="1"
                      value={apCounts[String(d.value)] || ''}
                      onChange={e => setApCounts(p => ({ ...p, [String(d.value)]: e.target.value }))}
                      placeholder="0"
                    />
                    {(parseFloat(apCounts[String(d.value)] || '0') || 0) > 0 && (
                      <div style={{ fontSize:9, color:'var(--green)', marginTop:2, fontFamily:'monospace' }}>
                        {((parseFloat(apCounts[String(d.value)] || '0') || 0) * d.value).toFixed(2).replace('.',',')} €
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ background:'var(--green-dim)', border:'1px solid rgba(62,207,142,.3)', borderRadius:10, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontSize:13, color:'var(--green)' }}>💰 Fondo inicial</span>
                <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:20, color:'var(--green)' }}>{totalAp.toFixed(2).replace('.',',')} €</span>
              </div>
            </div>
            <div style={{ textAlign:'left', marginBottom:24 }}>
              <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:6 }}>
                Observaciones (opcional)
              </label>
              <input
                style={{ ...S.input }}
                value={notasApertura}
                onChange={e => setNotasApertura(e.target.value)}
                placeholder="Ej: Turno de mañana, cajero Juan..."
                onKeyDown={e => e.key === 'Enter' && doApertura()}
              />
            </div>
            <button onClick={doApertura} disabled={cajaLoading} style={{
              width:'100%', padding:16, borderRadius:10, border:'none',
              background:'var(--green)', color:'#fff', cursor:'pointer',
              fontSize:16, fontWeight:700, fontFamily:'inherit',
              boxShadow:'0 6px 24px rgba(62,207,142,.4)',
            }}>
              {cajaLoading ? '...' : '🟢 Abrir caja y comenzar'}
            </button>
            <div style={{ marginTop:16, fontSize:11, color:'var(--text3)' }}>
              El sistema registrará todas las ventas de este turno
            </div>
          </div>
        </div>
      )}

      {/* ── CIERRE CAJA MODAL ── */}
      {cierreModal && openCaja && (
        <div style={{ position:'fixed', inset:0, zIndex:700, background:'rgba(26,29,46,.6)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)' }}
          onClick={e => { if(e.target===e.currentTarget) setCierreModal(false) }}>
          <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:32, width:420, boxShadow:'0 8px 32px rgba(89,122,166,.2)' }}>
            <div style={{ fontSize:36, textAlign:'center' as const, marginBottom:8 }}>🔴</div>
            <div style={{ fontSize:18, fontWeight:700, textAlign:'center' as const, marginBottom:4 }}>Cierre de Caja</div>
            <div style={{ color:'var(--text2)', fontSize:12, textAlign:'center' as const, marginBottom:20 }}>
              Abierta por {openCaja.opened_by_name} · {openCaja.opened_at ? new Date(openCaja.opened_at).toLocaleString('es-ES') : ''}
            </div>

            {/* Info apertura */}
            <div style={{ background:'var(--s2)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'var(--text2)' }}>Fondo inicial</span>
                <span style={{ fontFamily:'monospace', fontWeight:700 }}>{fmt(parseFloat(openCaja.fondo_inicial))}</span>
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:6 }}>
                Importe real contado en caja (€) *
              </label>
              <input
                style={{ ...S.input, fontSize:24, fontWeight:700, textAlign:'center' as const, fontFamily:'monospace', padding:'12px' }}
                type="number" step="0.01" min="0"
                value={realContado}
                onChange={e => setRealContado(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:5 }}>
                Cuenta todos los billetes y monedas en la caja ahora
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:6 }}>
                Observaciones (opcional)
              </label>
              <input style={S.input} value={notasCierre} onChange={e => setNotasCierre(e.target.value)} placeholder="Ej: Sin incidencias" />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setCierreModal(false)} style={{ ...S.btnOutline, flex:1 }}>Cancelar</button>
              <button onClick={doCierre} disabled={cajaLoading || !realContado} style={{
                flex:2, padding:12, borderRadius:8, border:'none',
                background: realContado ? 'var(--red)' : 'var(--s3)',
                color: realContado ? '#fff' : 'var(--text3)',
                cursor: realContado ? 'pointer' : 'not-allowed',
                fontSize:14, fontWeight:700, fontFamily:'inherit',
              }}>
                {cajaLoading ? '...' : '🔴 Cerrar caja y generar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function LoginScreen({ onLogin, loading, toast }: { onLogin: (u: string, p: string) => void; loading: boolean; toast: any }) {
  const [users, setUsers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [password, setPassword] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const pwRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/users?public=true')
      .then(r => r.json())
      .then(j => { setUsers((j.data || []).filter((u:any) => u.active)); setLoadingUsers(false) })
      .catch(() => setLoadingUsers(false))
  }, [])

  useEffect(() => {
    if (selected) setTimeout(() => pwRef.current?.focus(), 100)
  }, [selected])

  const roleColor = (role: string) => role==='admin'?'var(--amber)':role==='encargado'?'var(--teal)':'var(--accent)'
  const roleLabel = (role: string) => role==='admin'?'Admin':role==='encargado'?'Encargado':'Cajero'

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#f0f4ff,var(--bg))', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <img src="/logos/LOGO_HORIZONTAL_POSITIVO_CORPORATIVO.svg" alt="Logo" style={{ height:80, width:'auto', marginBottom:32, objectFit:'contain' }} />

      {!selected ? (
        <>
          <div style={{ fontSize:14, color:'var(--text2)', marginBottom:24 }}>Selecciona tu perfil</div>
          {loadingUsers ? (
            <div style={{ color:'var(--text3)', fontSize:13 }}>Cargando...</div>
          ) : (
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', justifyContent:'center', maxWidth:600 }}>
              {users.map(u => (
                <div key={u.id} onClick={() => { setSelected(u); setPassword('') }}
                  style={{ background:'var(--s1)', border:'2px solid var(--border)', borderRadius:16, padding:'24px 20px', width:140, textAlign:'center', cursor:'pointer', transition:'all .15s', boxShadow:'0 2px 12px rgba(89,122,166,.08)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(89,122,166,.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 12px rgba(89,122,166,.08)' }}>
                  {/* Avatar */}
                  <div style={{ width:72, height:72, borderRadius:'50%', margin:'0 auto 12px', overflow:'hidden', border:`3px solid ${roleColor(u.role)}`, background:'var(--s2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <img
                      src={`/avatars/${u.username}.jpg`}
                      alt={u.name}
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}
                      onError={e => {
                        const el = e.currentTarget
                        el.style.display = 'none'
                        const parent = el.parentElement!
                        parent.innerHTML = `<span style="font-size:28px">${u.role==='admin'?'👑':u.role==='encargado'?'🔑':'👤'}</span>`
                      }}
                    />
                  </div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{u.name}</div>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600, color: roleColor(u.role), background: u.role==='admin'?'var(--amber-dim)':u.role==='encargado'?'var(--teal-dim)':'var(--accent-dim)' }}>
                    {roleLabel(u.role)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:18, padding:36, width:340, textAlign:'center', boxShadow:'0 8px 40px rgba(89,122,166,.15)' }}>
          {/* Selected user avatar */}
          <div style={{ width:80, height:80, borderRadius:'50%', margin:'0 auto 12px', overflow:'hidden', border:`3px solid ${roleColor(selected.role)}`, background:'var(--s2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img src={`/avatars/${selected.username}.jpg`} alt={selected.name}
              style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.parentElement!.innerHTML=`<span style="font-size:32px">${selected.role==='admin'?'👑':selected.role==='encargado'?'🔑':'👤'}</span>` }} />
          </div>
          <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>{selected.name}</div>
          <span style={{ fontSize:11, padding:'2px 10px', borderRadius:20, fontWeight:600, color:roleColor(selected.role), background:selected.role==='admin'?'var(--amber-dim)':selected.role==='encargado'?'var(--teal-dim)':'var(--accent-dim)', display:'inline-block', marginBottom:24 }}>
            {roleLabel(selected.role)}
          </span>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:6 }}>Contraseña</label>
            <input ref={pwRef}
              style={{ width:'100%', background:'var(--s2)', border:'1px solid var(--border)', borderRadius:8, padding:'11px 14px', color:'var(--text)', fontFamily:'inherit', fontSize:16, outline:'none', textAlign:'center', letterSpacing:'0.1em' }}
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && password && onLogin(selected.username, password)}
            />
          </div>
          <button onClick={() => onLogin(selected.username, password)} disabled={loading || !password}
            style={{ width:'100%', padding:12, borderRadius:8, border:'none', background: password?'var(--accent)':'var(--s3)', color: password?'#fff':'var(--text3)', cursor: password?'pointer':'not-allowed', fontFamily:'inherit', fontSize:14, fontWeight:700, marginBottom:10, transition:'all .15s' }}>
            {loading ? '...' : 'Entrar'}
          </button>
          <button onClick={() => { setSelected(null); setPassword('') }}
            style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
            ← Cambiar perfil
          </button>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div style={{ position:'fixed', bottom:24, right:24, background: type==='ok' ? 'var(--green)' : 'var(--red)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, zIndex:999, boxShadow:'0 8px 32px rgba(0,0,0,.4)', animation:'fadeIn .2s' }}>
      {msg}
    </div>
  )
}
