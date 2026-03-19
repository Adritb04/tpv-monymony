'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api-client'
import PurchasesModule from './PurchasesModule'
import MobileTPV from './MobileTPV'

// ── helpers ──────────────────────────────────────────────────────
const fmt = (n: number) => (n || 0).toFixed(2).replace('.', ',') + ' €'
const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')
const NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE    || 'MI TIENDA',
  nif:       process.env.NEXT_PUBLIC_NEGOCIO_NIF       || 'B00000000',
  direccion: process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION || 'Calle Mayor, 1',
  cp:        process.env.NEXT_PUBLIC_NEGOCIO_CP        || '28001',
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD || 'Madrid',
  telefono:  process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO  || '',
  email:     process.env.NEXT_PUBLIC_NEGOCIO_EMAIL     || '',
  serie:     process.env.NEXT_PUBLIC_NEGOCIO_SERIE     || 'A',
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
  modal: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,.8)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(5px)' },
  modalBox: { background:'var(--s1)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:420, maxHeight:'90vh', overflowY:'auto' as const, boxShadow:'0 40px 80px rgba(0,0,0,.6)' },
  table: { width:'100%', borderCollapse:'collapse' as const },
  th: { textAlign:'left' as const, fontSize:10, color:'var(--text2)', fontWeight:600, padding:'6px 10px', borderBottom:'1px solid var(--border)', textTransform:'uppercase' as const, letterSpacing:'.05em' },
  td: { padding:'9px 10px', borderBottom:'1px solid var(--border)', fontSize:12, verticalAlign:'middle' as const },
}

// ── TICKET HTML ──────────────────────────────────────────────────
function buildTicketHTML(s: any): string {
  const isRect = s.type === 'rectificativo'
  const bd = s.iva_breakdown || {}
  let ivaLines = ''
  ;[4, 10, 21].forEach(r => {
    const g = bd[String(r)]
    if (g?.base > 0) ivaLines +=
      `<div style="display:flex;justify-content:space-between;font-size:10px;color:#555"><span>Base IVA ${r}%</span><span>${fmtN(g.base)} €</span></div>` +
      `<div style="display:flex;justify-content:space-between;font-size:10px;color:#555"><span>Cuota IVA ${r}%</span><span>${fmtN(g.iva)} €</span></div>`
  })
  const rebu = bd.rebu
  const rebuNote = rebu?.total > 0 ? `
    <div style="border-top:1px dashed #ccc;margin:4px 0"></div>
    <div style="display:flex;justify-content:space-between;font-size:10px"><span>Artículos REBU</span><span>${fmtN(rebu.total)} €</span></div>
    <div style="font-size:8px;color:#999">IVA incluido no deducible — Régimen Especial Bienes Usados (Art. 135-139 LIVA)</div>` : ''
  const items = (s.items || []).map((i: any) => `
    <div style="display:flex;justify-content:space-between;font-size:10px"><span>${i.emoji || ''} ${i.name} x${i.qty}</span><span>${fmtN(i.line_total || i.price * i.qty)} €</span></div>
    <div style="font-size:8px;color:#999;padding-left:8px">${i.regime === 'rebu' ? 'REBU — IVA s/margen' : `IVA ${i.iva_rate}%`}</div>`).join('')
  return `
<div style="font-family:'Courier New',monospace;font-size:11px;color:#000;max-width:320px;margin:0 auto">
  <div style="text-align:center;font-weight:700;font-size:13px">${s.razon_social || NEGOCIO.nombre}</div>
  <div style="text-align:center">NIF: ${s.nif || NEGOCIO.nif}</div>
  <div style="text-align:center">${NEGOCIO.direccion}, ${NEGOCIO.cp} ${NEGOCIO.localidad}</div>
  <div style="text-align:center">Tel: ${NEGOCIO.telefono}</div>
  <div style="border-top:1px dashed #999;margin:5px 0"></div>
  ${isRect ? `<div style="text-align:center;color:red;font-weight:700">⚠️ FACTURA RECTIFICATIVA</div>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:red"><span>Rectifica:</span><span>${s.rect_of}</span></div>
  <div style="font-size:9px;color:red">Motivo: ${s.rect_reason}</div>
  <div style="border-top:1px dashed #999;margin:5px 0"></div>` : ''}
  <div style="display:flex;justify-content:space-between"><span style="font-weight:700">${isRect ? 'FACTURA RECTIFICATIVA' : 'FACTURA SIMPLIFICADA'}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:10px"><span>Nº Ticket</span><span>${s.ticket_id}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:10px"><span>Fecha</span><span>${s.date} ${s.time}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:10px"><span>Cajero</span><span>${s.cashier_name}</span></div>
  <div style="border-top:1px dashed #999;margin:5px 0"></div>
  ${items}
  <div style="border-top:1px dashed #999;margin:5px 0"></div>
  ${ivaLines}
  ${rebuNote}
  ${ivaLines || rebuNote ? '<div style="border-top:1px dashed #999;margin:5px 0"></div>' : ''}
  <div style="display:flex;justify-content:space-between;font-weight:700"><span>Base imponible</span><span>${fmtN(Math.abs(s.base))} €</span></div>
  <div style="display:flex;justify-content:space-between;font-weight:700"><span>IVA total</span><span>${fmtN(Math.abs(s.iva_total))} €</span></div>
  <div style="border-top:2px solid #000;margin:5px 0"></div>
  <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:${isRect ? 'red' : '#000'}">
    <span>TOTAL ${isRect ? 'RECTIFICADO' : ''}</span><span>${isRect ? '−' : ''}${fmtN(Math.abs(s.total))} €</span>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:10px"><span>Método de pago</span><span>${s.pay === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</span></div>
  <div style="border-top:1px dashed #999;margin:5px 0"></div>
  <div style="font-size:8px;color:#999">Software: ${s.sw_name} v${s.sw_version}</div>
  <div style="font-size:7px;color:#bbb;word-break:break-all">Hash: ${(s.hash || '').substring(0, 40)}...</div>
  <div style="text-align:center;margin-top:6px;font-size:10px">Gracias por su compra</div>
</div>`
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function TPVApp() {
  const [token, setToken] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768)
  check()
  window.addEventListener('resize', check)
  return () => window.removeEventListener('resize', check)
}, [])
  const [user, setUser]   = useState<any>(null)
  const [view, setView]   = useState<'tpv' | 'history' | 'admin'>('tpv')
  const [clock, setClock] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // TPV state
  const [products, setProducts]   = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cart, setCart]           = useState<any[]>([])
  const [payMethod, setPayMethod] = useState<'efectivo' | 'tarjeta'>('efectivo')
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
  const [adminTab, setAdminTab]   = useState<'products' | 'categories' | 'users' | 'log' | 'integrity' | 'rgpd' | 'compras'>('products')
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [opLog, setOpLog]         = useState<any[]>([])
  const [integrity, setIntegrity] = useState<any>(null)

  // Modals
  const [ticketModal, setTicketModal] = useState<any>(null)
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

  useEffect(() => { if (token) loadProducts() }, [token, loadProducts])

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

  useEffect(() => { if (view === 'history') loadSales() }, [view, loadSales])

  // ── Load admin data ──
  const loadAdminTab = useCallback(async (tab: string) => {
    if (!token) return
    try {
      if (tab === 'users') {
        const res = await api.users.list(token)
        setAdminUsers(res.data)
      } else if (tab === 'log') {
        const res = await api.log(token)
        setOpLog(res.data)
      } else if (tab === 'integrity') {
        const res = await api.integrity(token)
        setIntegrity(res.data)
      } else if (tab === 'products') {
        loadProducts()
      }
    } catch (e: any) { showToast(e.message, 'err') }
  }, [token, loadProducts])

  useEffect(() => { if (view === 'admin') loadAdminTab(adminTab) }, [view, adminTab, loadAdminTab])

  // ── LOGIN ──
  const doLogin = async (username: string, password: string) => {
    try {
      setLoading(true)
      const res = await api.login(username, password)
      setToken(res.token)
      setUser(res.user)
      localStorage.setItem('tpv_token', res.token)
      localStorage.setItem('tpv_user', JSON.stringify(res.user))
    } catch (e: any) {
      showToast(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  // Restore session
  useEffect(() => {
    const t = localStorage.getItem('tpv_token')
    const u = localStorage.getItem('tpv_user')
    if (t && u) { setToken(t); setUser(JSON.parse(u)) }
  }, [])

  const doLogout = () => {
    setToken(null); setUser(null); setCart([])
    localStorage.removeItem('tpv_token')
    localStorage.removeItem('tpv_user')
  }

  // ── CART ──
  const addToCart = (prd: any) => {
    if (!prd.active || prd.stock === 0) return
    setCart(prev => {
      const ex = prev.find(i => i.id === prd.id)
      if (ex) {
        if (ex.qty >= prd.stock) return prev
        return prev.map(i => i.id === prd.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, {
        id: prd.id, name: prd.name, emoji: prd.emoji,
        price: parseFloat(prd.price), iva_rate: prd.iva_rate,
        regime: prd.regime, cost_price: parseFloat(prd.cost_price || 0),
        qty: 1,
      }]
    })
  }

  const chgQty = (id: number, d: number) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + d } : i).filter(i => i.qty > 0))

  const calcTotals = () => {
    let base = 0, ivaTotal = 0
    const groups: Record<string, any> = {}
    cart.forEach(i => {
      const total = i.price * i.qty
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
    setLoading(true)
    try {
      const items = cart.map(i => {
        const lineTotal = i.price * i.qty
        const lineBase  = i.regime === 'rebu'
          ? lineTotal - Math.max(0, i.price - i.cost_price) * i.qty * i.iva_rate / (100 + i.iva_rate)
          : lineTotal / (1 + i.iva_rate / 100)
        return {
          product_id: i.id, name: i.name, emoji: i.emoji,
          price: i.price, qty: i.qty,
          regime: i.regime, iva_rate: i.iva_rate, cost_price: i.cost_price,
          line_total: lineTotal,
          line_base:  lineBase,
          line_iva:   lineTotal - lineBase,
        }
      })
      const res = await api.sales.create(token, { items, pay: payMethod })
      setCart([])
      setPayMethod('efectivo')
      loadProducts() // refresh stock
      setTicketModal(res.data)
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
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  )

  // ── PRINT TICKET ──
  const printTicket = (s: any) => {
    const w = window.open('', '_blank', 'width=400,height=700')!
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket ${s.ticket_id}</title>
    <style>body{margin:20px;background:#fff}@media print{body{margin:0}}</style></head>
    <body>${buildTicketHTML(s)}</body></html>`)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: LOGIN
  // ═══════════════════════════════════════════════════════════════
  if (!token || !user) {
    return (
      <div style={{ ...S.app, alignItems:'center', justifyContent:'center',
        background:'radial-gradient(ellipse 80% 80% at 20% 60%,#1a1060,var(--bg))' }}>
        <div style={{ background:'var(--s1)', border:'1px solid var(--border)', borderRadius:18, padding:40, width:400, boxShadow:'0 48px 96px rgba(0,0,0,.7)', textAlign:'center' }}>
          
          <div style={{ fontSize:21, fontWeight:700, marginBottom:4 }}>TPV MONY MONY</div>
          <div style={{ color:'var(--text2)', fontSize:12, marginBottom:24 }}>Introduce tus credenciales</div>
          <LoginForm onLogin={doLogin} loading={loading} />
          <div style={{ fontSize:10, color:'var(--text3)', marginTop:16 }}>
            Demo: admin / admin123 · encargado / enc123 · cajero1 / caj123
          </div>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} />}
      </div>
    )
  }
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
  // RENDER: APP
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={S.app}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        <span style={{ fontWeight:700, fontSize:15, color:'var(--accent)', marginRight:4 }}>MONY MONY</span>
        
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
          {user.role === 'admin' && (
            <button onClick={() => setView('admin')} style={{
              padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'inherit',
              background: view==='admin' ? 'var(--amber)' : 'none',
              color: view==='admin' ? '#000' : 'var(--text2)',
            }}>⚙️ Admin</button>
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
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
              <input style={S.input} placeholder="🔍 Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', fontFamily:'monospace' }}>{fmt(parseFloat(p.price))}</div>
                  <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, fontWeight:600, marginTop:3, display:'inline-block',
                    background: p.regime==='rebu'?'var(--teal-dim)':'var(--accent-dim)',
                    color: p.regime==='rebu'?'var(--teal)':'var(--accent)' }}>
                    {p.regime==='rebu' ? 'REBU' : `IVA ${p.iva_rate}%`}
                  </span>
                  <div style={{ fontSize:10, color: p.stock<5 ? 'var(--amber)' : 'var(--text3)', marginTop:2 }}>
                    Stock: {p.stock}
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
              <span style={{ background:'var(--accent)', color:'#fff', borderRadius:20, padding:'2px 7px', fontSize:11, fontWeight:700 }}>{cart.reduce((a,b)=>a+b.qty,0)}</span>
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
                      <div style={{ fontSize:10, color:'var(--text2)' }}>{fmt(i.price)} · <span style={{ color:i.regime==='rebu'?'var(--teal)':'var(--accent)' }}>{i.regime==='rebu'?'REBU':`IVA ${i.iva_rate}%`}</span></div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <button onClick={() => chgQty(i.id, -1)} style={{ width:20, height:20, borderRadius:4, border:'1px solid var(--border)', background:'var(--s3)', color:'var(--text)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                      <span style={{ fontSize:12, fontWeight:600, minWidth:16, textAlign:'center', fontFamily:'monospace' }}>{i.qty}</span>
                      <button onClick={() => chgQty(i.id, 1)} style={{ width:20, height:20, borderRadius:4, border:'1px solid var(--border)', background:'var(--s3)', color:'var(--text)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                    </div>
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
              <button onClick={checkout} disabled={!cart.length || loading} style={{
                width:'100%', padding:11, borderRadius:8, border:'none',
                background: cart.length ? 'var(--green)' : 'var(--s3)',
                color: cart.length ? '#fff' : 'var(--text3)',
                cursor: cart.length ? 'pointer' : 'not-allowed',
                fontSize:14, fontWeight:700, fontFamily:'inherit',
              }}>
                {loading ? '...' : cart.length ? `Cobrar ${fmt(total)}` : 'Cobrar'}
              </button>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} style={{ ...S.btnOutline, width:'100%', marginTop:5, fontSize:11 }}>Vaciar carrito</button>
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
                    <tr key={s.id} style={{ opacity: isRect ? .7 : 1 }}
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
              ['integrity','🔒','Integridad'],
              ['rgpd','🛡️','RGPD'],
              ['compras','🛒','Compras'],
            ] as [typeof adminTab, string, string][]).map(([tab, icon, label]) => (
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
                          <td style={{ ...S.td, fontWeight:600 }}>{p.name}</td>
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
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', flexShrink:0 }}>
                  <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>📜 Log de Operaciones</span>
                  <button onClick={() => loadAdminTab('log')} style={{ ...S.btn(), padding:'6px 11px', fontSize:11 }}>🔄</button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
                  {opLog.map(e => (
                    <div key={e.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', alignItems:'flex-start' }}>
                      <span style={{ fontSize:15, flexShrink:0 }}>{{ venta:'🟢', rect:'🔴', auth:'🔵', admin:'🟡', system:'⚪' }[e.type as string] || '⚪'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{e.action}</div>
                        <div style={{ fontSize:11, color:'var(--text2)' }}>{e.detail} <span style={{ color:'var(--text3)' }}>· {e.username}</span></div>
                      </div>
                      <span style={{ ...S.badge(
                        e.type==='venta'?'var(--green)':e.type==='rect'?'var(--red)':e.type==='auth'?'var(--accent)':e.type==='admin'?'var(--amber)':'var(--text2)',
                        e.type==='venta'?'var(--green-dim)':e.type==='rect'?'var(--red-dim)':e.type==='auth'?'var(--accent-dim)':e.type==='admin'?'var(--amber-dim)':'var(--s3)'
                      ), fontSize:9, flexShrink:0 }}>{e.type}</span>
                      <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'monospace', whiteSpace:'nowrap', flexShrink:0 }}>{e.dt}</span>
                    </div>
                  ))}
                  {!opLog.length && <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Sin operaciones</div>}
                </div>
              </div>
            )}

            {/* Integrity tab */}
            {adminTab === 'integrity' && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', flexShrink:0 }}>
                  <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>🔒 Integridad Verifactu</span>
                  <button onClick={() => loadAdminTab('integrity')} style={S.btn('var(--amber)')}>🔍 Verificar cadena</button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
                  {integrity && (
                    <div style={{ ...S.card, marginBottom:16, background: integrity.ok ? 'var(--green-dim)' : 'var(--red-dim)', border:`1px solid ${integrity.ok?'rgba(62,207,142,.3)':'rgba(240,62,62,.3)'}`, color: integrity.ok ? 'var(--green)' : 'var(--red)' }}>
                      {integrity.ok ? `✅ Cadena verificada — ${integrity.total} tickets íntegros. Sin anomalías.`
                        : `⚠️ ${integrity.broken} anomalía(s) en: ${integrity.broken_tickets?.join(', ')}`}
                    </div>
                  )}
                  <div style={{ ...S.card, fontSize:12, color:'var(--text2)', lineHeight:1.8, maxWidth:600 }}>
                    <span style={{ color:'var(--amber)', fontWeight:700 }}>¿Qué verifica este sistema?</span><br/>
                    Cada ticket genera un <b style={{ color:'var(--text)' }}>hash SHA-256 encadenado server-side</b> que incluye el hash anterior, el ID del ticket, el NIF, el importe y el timestamp.<br/><br/>
                    Al ejecutarse en servidor (Node.js + Supabase), el hash es computado y guardado de forma <b style={{ color:'var(--text)' }}>inalterable</b> — nadie puede modificar un ticket sin que la cadena se rompa.<br/><br/>
                    Conforme al <b style={{ color:'var(--amber)' }}>Reglamento Verifactu</b> y los principios de inalterabilidad de la <b style={{ color:'var(--amber)' }}>Ley 11/2021</b>.
                  </div>
                </div>
              </div>
            )}

            {/* RGPD tab */}
            {adminTab === 'rgpd' && (
              <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
                <div style={{ ...S.card, fontSize:12, color:'var(--text2)', lineHeight:1.9, maxWidth:700 }}>
                  <span style={{ color:'var(--amber)', fontWeight:700 }}>Estado RGPD / LOPDGDD</span><br/><br/>
                  ✅ Autenticación con contraseña hasheada (bcrypt cost=12)<br/>
                  ✅ Control de acceso por roles (LOPDGDD Art. 32)<br/>
                  ✅ Hash encadenado server-side inalterable (Ley 11/2021)<br/>
                  ✅ Log de operaciones con trazabilidad completa<br/>
                  ✅ Tickets rectificativos sin borrado (trazabilidad total)<br/>
                  ✅ Datos almacenados en Supabase (servidores en UE disponibles)<br/>
                  ✅ Exportación JSON para copias de seguridad<br/>
                  ✅ Soft-delete de usuarios (no se borran, mantienen el historial)<br/><br/>
                  <span style={{ color:'var(--amber)', fontWeight:700 }}>Conservación obligatoria:</span><br/>
                  Mínimo 4 años (LGT Art. 66-68) · Recomendado 6 años (Cco Art. 30)<br/><br/>
                  <span style={{ color:'var(--amber)', fontWeight:700 }}>Responsable:</span> {NEGOCIO.nombre} · NIF {NEGOCIO.nif} · {NEGOCIO.email}<br/><br/>
                  <span style={{ color:'var(--red)' }}>⚠️ Pendiente para cumplimiento 100%:</span><br/>
                  · Registro de Actividades de Tratamiento (RAT) — documento físico/digital firmado por el responsable<br/>
                  · Contrato con Supabase (DPA) — ir a supabase.com → Settings → Legal → Data Processing Agreement<br/>
                  · Envío automático AEAT (Veri*factu) — requiere certificado digital de empresa
                </div>
                <div style={{ marginTop:14 }}>
                  <button onClick={() => setRgpdModal(true)} style={S.btn('var(--amber)')}>📄 Ver política de privacidad</button>
                </div>
              </div>
            )}

            {adminTab === 'compras' && (
              <PurchasesModule token={token!} categories={categories} />
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
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Emoji</label>
                  <input style={S.input} value={form.emoji||'📦'} onChange={e => setForm({...form, emoji:e.target.value})} maxLength={4} /></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Categoría</label>
                  <select style={S.input} value={form.category_id||''} onChange={e => setForm({...form, category_id:parseInt(e.target.value)})}>
                    <option value="">Seleccionar</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select></div>
                <div><label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase', display:'block', marginBottom:4 }}>Precio venta (€)</label>
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

      {/* ── TOAST ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function LoginForm({ onLogin, loading }: { onLogin: (u: string, p: string) => void; loading: boolean }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  return (
    <div style={{ textAlign:'left' }}>
      {[['Usuario', u, setU, 'text', 'cajero1'], ['Contraseña', p, setP, 'password', '••••••']].map(([label, val, set, type, ph]) => (
        <div key={label as string} style={{ marginBottom:10 }}>
          <label style={{ fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:4 }}>{label as string}</label>
          <input
            style={{ width:'100%', background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none' }}
            type={type as string} value={val as string} placeholder={ph as string}
            onChange={e => (set as Function)(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onLogin(u, p)}
          />
        </div>
      ))}
      <button onClick={() => onLogin(u, p)} disabled={loading}
        style={{ width:'100%', padding:11, borderRadius:6, border:'none', background:'var(--accent)', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, marginTop:4 }}>
        {loading ? '...' : 'Iniciar sesión'}
      </button>
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
