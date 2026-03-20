'use client'

import { useState, useEffect, useCallback } from 'react'

const fmt  = (n: number) => (n || 0).toFixed(2).replace('.', ',') + ' €'
const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')
const pct  = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0%'

const NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE    || 'MI TIENDA',
  nif:       process.env.NEXT_PUBLIC_NEGOCIO_NIF       || 'B00000000',
  direccion: process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION || '',
  cp:        process.env.NEXT_PUBLIC_NEGOCIO_CP        || '',
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD || '',
}

const S = {
  card:   { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  input:  { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 11px', color:'var(--text)', fontFamily:'inherit', fontSize:13, outline:'none' },
  label:  { fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:4 },
  btn:    (bg='var(--accent)', c='#fff') => ({ padding:'8px 14px', borderRadius:7, border:'none', background:bg, color:c, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }),
  btnOut: { padding:'7px 12px', borderRadius:7, border:'1px solid var(--border)', background:'none', color:'var(--text2)', cursor:'pointer', fontSize:11, fontFamily:'inherit' },
  th:     { textAlign:'left' as const, fontSize:10, color:'var(--text2)', fontWeight:600, padding:'6px 10px', borderBottom:'1px solid var(--border)', textTransform:'uppercase' as const, letterSpacing:'.05em' },
  td:     { padding:'8px 10px', borderBottom:'1px solid var(--border)', fontSize:12, verticalAlign:'middle' as const },
}

interface ReportsModuleProps {
  token: string
  categories: any[]
  users: any[]
}

export default function ReportsModule({ token, categories, users }: ReportsModuleProps) {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [filters, setFilters] = useState({
    from: firstOfMonth, to: today,
    cashier: '', pay: '', regime: '', category: '', product: '', type: '',
  })
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'resumen'|'productos'|'categorias'|'cajeros'|'evolucion'|'iva'>('resumen')
  const [toast, setToast]     = useState<string|null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const setF = (k: string, v: string) => setFilters(p => ({ ...p, [k]: v }))

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const res = await fetch(`/api/reports?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      setData(j.data)
    } catch (e: any) { showToast(e.message) }
    finally { setLoading(false) }
  }, [token, filters])

  useEffect(() => { loadReport() }, []) // load on mount with defaults

  // ── Quick date presets ──
  const setPreset = (preset: string) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    if (preset === 'hoy') setFilters(p => ({ ...p, from: today, to: today }))
    else if (preset === 'ayer') {
      const d = new Date(now); d.setDate(d.getDate() - 1)
      setFilters(p => ({ ...p, from: iso(d), to: iso(d) }))
    } else if (preset === 'semana') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      setFilters(p => ({ ...p, from: iso(d), to: today }))
    } else if (preset === 'mes') {
      setFilters(p => ({ ...p, from: firstOfMonth, to: today }))
    } else if (preset === 'trim') {
      const d = new Date(now); d.setMonth(d.getMonth() - 3)
      setFilters(p => ({ ...p, from: iso(d), to: today }))
    } else if (preset === 'anyo') {
      setFilters(p => ({ ...p, from: `${now.getFullYear()}-01-01`, to: today }))
    }
  }

  // ── Export CSV ──
  const exportCSV = () => {
    if (!data) return
    const rows: string[][] = []
    if (activeTab === 'productos') {
      rows.push(['Producto','Unidades','Total (€)','% sobre ventas'])
      data.product_ranking.forEach((p: any) => rows.push([p.name, p.qty, fmtN(p.total), pct(p.total, data.summary.importe_bruto)]))
    } else if (activeTab === 'categorias') {
      rows.push(['Categoría','Unidades','Total (€)','% sobre ventas'])
      data.category_breakdown.forEach((c: any) => {
        const cat = categories.find((x:any) => String(x.id) === c.name)
        rows.push([cat ? `${cat.icon} ${cat.name}` : 'Sin categoría', c.qty, fmtN(c.total), pct(c.total, data.summary.importe_bruto)])
      })
    } else if (activeTab === 'cajeros') {
      rows.push(['Cajero','Nº Ventas','Total (€)','Efectivo (€)','Tarjeta (€)'])
      data.cashier_breakdown.forEach((c: any) => rows.push([c.name, c.ventas, fmtN(c.total), fmtN(c.efectivo), fmtN(c.tarjeta)]))
    } else if (activeTab === 'evolucion') {
      rows.push(['Fecha','Nº Ventas','Total (€)','Base (€)','IVA (€)'])
      data.daily_evolution.forEach((d: any) => rows.push([d.date, d.ventas, fmtN(d.total), fmtN(d.base), fmtN(d.iva)]))
    } else if (activeTab === 'iva') {
      rows.push(['Tipo IVA','Base imponible (€)','Cuota IVA (€)','Total bruto (€)'])
      Object.entries(data.iva_breakdown).forEach(([k, v]: any) => rows.push([k==='rebu'?'REBU':k+'%', fmtN(v.base), fmtN(v.cuota), fmtN(v.total)]))
    } else {
      const s = data.summary
      rows.push(['Concepto','Valor'])
      rows.push(['Nº Ventas', s.total_ventas], ['Nº Rectificativos', s.total_rects],
        ['Importe bruto', fmtN(s.importe_bruto)+' €'], ['Rectificativos', fmtN(s.importe_rects)+' €'],
        ['Importe neto', fmtN(s.importe_neto)+' €'], ['Base imponible', fmtN(s.base_imponible)+' €'],
        ['IVA total', fmtN(s.iva_total)+' €'], ['Efectivo', fmtN(s.efectivo)+' €'], ['Tarjeta', fmtN(s.tarjeta)+' €'])
    }
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }))
    a.download = `informe_${activeTab}_${filters.from}_${filters.to}.csv`
    a.click()
    showToast('CSV exportado ✓')
  }

  // ── Export PDF ──
  const exportPDF = () => {
    if (!data) return
    const s = data.summary
    const w = window.open('', '_blank', 'width=900,height=1000')!
    const periodoStr = filters.from === filters.to ? filters.from : `${filters.from} — ${filters.to}`

    const productRows = data.product_ranking.slice(0, 15).map((p: any, i: number) => `
      <tr><td>${i+1}</td><td>${p.name}</td><td style="text-align:right">${p.qty}</td>
      <td style="text-align:right">${fmtN(p.total)} €</td>
      <td style="text-align:right">${pct(p.total, s.importe_bruto)}</td></tr>`).join('')

    const ivaRows = Object.entries(data.iva_breakdown).map(([k, v]: any) => `
      <tr><td><b>${k==='rebu'?'REBU (margen)':k+'%'}</b></td>
      <td style="text-align:right">${fmtN(v.base)} €</td>
      <td style="text-align:right">${fmtN(v.cuota)} €</td>
      <td style="text-align:right">${fmtN(v.total)} €</td></tr>`).join('')

    const cajeroRows = data.cashier_breakdown.map((c: any) => `
      <tr><td>${c.name}</td><td style="text-align:right">${c.ventas}</td>
      <td style="text-align:right">${fmtN(c.total)} €</td>
      <td style="text-align:right">${fmtN(c.efectivo)} €</td>
      <td style="text-align:right">${fmtN(c.tarjeta)} €</td></tr>`).join('')

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe de Ventas</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#000;padding:24px}
      h1{font-size:18px;margin-bottom:2px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;color:#333}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px}
      .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
      .stat{border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center}
      .stat-label{font-size:9px;color:#888;text-transform:uppercase;margin-bottom:4px}
      .stat-val{font-size:16px;font-weight:700}
      .stat-val.green{color:#2b8a3e}.stat-val.blue{color:#1864ab}.stat-val.red{color:#c92a2a}
      table{width:100%;border-collapse:collapse;margin-bottom:14px}
      th{background:#f5f5f5;padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;border:1px solid #ddd}
      td{padding:5px 8px;border:1px solid #eee;font-size:11px}
      tr:nth-child(even) td{background:#fafafa}
      .bar-wrap{background:#eee;border-radius:3px;height:8px;width:100%;margin-top:3px}
      .bar{background:#4dabf7;border-radius:3px;height:8px}
      .footer{margin-top:20px;font-size:9px;color:#888;border-top:1px solid #ccc;padding-top:8px;display:flex;justify-content:space-between}
      @media print{body{padding:12px}}
    </style></head><body>
    <div class="header">
      <div><h1>${NEGOCIO.nombre}</h1><div>NIF: ${NEGOCIO.nif} · ${NEGOCIO.direccion} ${NEGOCIO.cp} ${NEGOCIO.localidad}</div></div>
      <div style="text-align:right"><div style="font-size:15px;font-weight:700">INFORME DE VENTAS</div>
        <div>Período: ${periodoStr}</div>
        <div>Generado: ${new Date().toLocaleString('es-ES')}</div></div>
    </div>

    <h2>Resumen del período</h2>
    <div class="grid4">
      <div class="stat"><div class="stat-label">Nº Ventas</div><div class="stat-val blue">${s.total_ventas}</div></div>
      <div class="stat"><div class="stat-label">Importe bruto</div><div class="stat-val green">${fmtN(s.importe_bruto)} €</div></div>
      <div class="stat"><div class="stat-label">Importe neto</div><div class="stat-val green">${fmtN(s.importe_neto)} €</div></div>
      <div class="stat"><div class="stat-label">IVA total</div><div class="stat-val">${fmtN(s.iva_total)} €</div></div>
    </div>
    <div class="grid2">
      <div class="stat"><div class="stat-label">💵 Efectivo</div><div class="stat-val">${fmtN(s.efectivo)} €</div></div>
      <div class="stat"><div class="stat-label">💳 Tarjeta</div><div class="stat-val">${fmtN(s.tarjeta)} €</div></div>
    </div>

    <h2>Resumen IVA — Modelo 303</h2>
    <table><thead><tr><th>Tipo</th><th>Base Imponible</th><th>Cuota IVA</th><th>Total Bruto</th></tr></thead>
    <tbody>${ivaRows}
    <tr style="font-weight:700;background:#f0f0f0">
      <td>TOTALES</td>
      <td style="text-align:right">${fmtN(s.base_imponible)} €</td>
      <td style="text-align:right">${fmtN(s.iva_total)} €</td>
      <td style="text-align:right">${fmtN(s.importe_bruto)} €</td>
    </tr></tbody></table>

    <h2>Top 15 productos más vendidos</h2>
    <table><thead><tr><th>#</th><th>Producto</th><th>Uds.</th><th>Total</th><th>% ventas</th></tr></thead>
    <tbody>${productRows}</tbody></table>

    <h2>Comparativa por cajero</h2>
    <table><thead><tr><th>Cajero</th><th>Nº Ventas</th><th>Total</th><th>Efectivo</th><th>Tarjeta</th></tr></thead>
    <tbody>${cajeroRows}</tbody></table>

    <div class="footer">
      <span>TPV-Legal-ES · Informe generado automáticamente</span>
      <span>Período: ${periodoStr}</span>
    </div>
    </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 400)
    showToast('PDF generado ✓')
  }

  // ── Simple bar chart ──
  const BarChart = ({ data: bars, valueKey, labelKey, maxBars = 10 }: any) => {
    const top = bars.slice(0, maxBars)
    const max = Math.max(...top.map((b: any) => b[valueKey]))
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {top.map((b: any, i: number) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:140, fontSize:11, color:'var(--text2)', textAlign:'right', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b[labelKey]}</div>
            <div style={{ flex:1, height:20, background:'var(--s3)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ width:`${max > 0 ? (b[valueKey]/max)*100 : 0}%`, height:'100%', background:'var(--accent)', borderRadius:4, transition:'width .3s', minWidth: b[valueKey]>0?2:0 }} />
            </div>
            <div style={{ width:80, fontSize:11, fontFamily:'monospace', fontWeight:600, color:'var(--green)', flexShrink:0, textAlign:'right' }}>{fmt(b[valueKey])}</div>
          </div>
        ))}
      </div>
    )
  }

  const tabStyle = (t: string) => ({
    padding:'6px 13px', borderRadius:20, border:`1px solid ${activeTab===t?'var(--accent)':'var(--border)'}`,
    background: activeTab===t?'var(--accent-dim)':'none', color: activeTab===t?'var(--accent)':'var(--text2)',
    cursor:'pointer', fontSize:11, fontWeight:500, fontFamily:'inherit', whiteSpace:'nowrap' as const,
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>

      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>📊 Informes de Ventas</span>
          <button onClick={exportCSV} disabled={!data} style={{ ...S.btnOut, color:'var(--green)', borderColor:'rgba(62,207,142,.4)' }}>📊 CSV</button>
          <button onClick={exportPDF} disabled={!data} style={{ ...S.btnOut, color:'var(--amber)', borderColor:'rgba(245,159,0,.4)' }}>📄 PDF</button>
          <button onClick={loadReport} disabled={loading} style={S.btn()}>
            {loading ? '⏳' : '🔍 Generar informe'}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end' }}>
          {/* Date presets */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {[['hoy','Hoy'],['ayer','Ayer'],['semana','7 días'],['mes','Este mes'],['trim','Trimestre'],['anyo','Este año']].map(([p,l]) => (
              <button key={p} onClick={() => setPreset(p)} style={{ ...S.btnOut, fontSize:10, padding:'4px 8px' }}>{l}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <div>
              <label style={S.label}>Desde</label>
              <input style={{ ...S.input, width:130 }} type="date" value={filters.from} onChange={e => setF('from', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Hasta</label>
              <input style={{ ...S.input, width:130 }} type="date" value={filters.to} onChange={e => setF('to', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Cajero</label>
              <select style={{ ...S.input, width:130 }} value={filters.cashier} onChange={e => setF('cashier', e.target.value)}>
                <option value="">Todos</option>
                {users.map((u:any) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Pago</label>
              <select style={{ ...S.input, width:110 }} value={filters.pay} onChange={e => setF('pay', e.target.value)}>
                <option value="">Todos</option>
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Régimen</label>
              <select style={{ ...S.input, width:110 }} value={filters.regime} onChange={e => setF('regime', e.target.value)}>
                <option value="">Todos</option>
                <option value="iva">IVA</option>
                <option value="rebu">REBU</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Tipo</label>
              <select style={{ ...S.input, width:130 }} value={filters.type} onChange={e => setF('type', e.target.value)}>
                <option value="">Ventas y rectif.</option>
                <option value="venta">Solo ventas</option>
                <option value="rectificativo">Solo rectif.</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Producto</label>
              <input style={{ ...S.input, width:130 }} value={filters.product} onChange={e => setF('product', e.target.value)} placeholder="Buscar..." />
            </div>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div style={{ display:'flex', gap:6, padding:'10px 20px', borderBottom:'1px solid var(--border)', overflowX:'auto', flexShrink:0 }}>
        {([['resumen','📋 Resumen'],['productos','🏆 Productos'],['categorias','🏷️ Categorías'],['cajeros','👤 Cajeros'],['evolucion','📈 Evolución'],['iva','🧾 IVA / Mod.303']] as [typeof activeTab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(t)}>{l}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', minHeight:0 }}>
        {loading && <div style={{ textAlign:'center', color:'var(--text3)', padding:40, fontSize:14 }}>⏳ Cargando informe...</div>}

        {!loading && !data && (
          <div style={{ textAlign:'center', color:'var(--text3)', padding:40 }}>Selecciona filtros y pulsa "Generar informe"</div>
        )}

        {!loading && data && (
          <>
            {/* ── RESUMEN ── */}
            {activeTab === 'resumen' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[
                    ['Ventas', data.summary.total_ventas, 'var(--accent)', 'tickets'],
                    ['Importe bruto', fmt(data.summary.importe_bruto), 'var(--green)', 'c/IVA'],
                    ['Importe neto', fmt(data.summary.importe_neto), 'var(--green)', 'tras rectif.'],
                    ['Base imponible', fmt(data.summary.base_imponible), 'var(--text)', ''],
                    ['IVA total', fmt(data.summary.iva_total), 'var(--amber)', ''],
                    ['Rectificativos', `${data.summary.total_rects} (−${fmt(data.summary.importe_rects)})`, 'var(--red)', ''],
                  ].map(([label, val, color, sub]) => (
                    <div key={label as string} style={S.card}>
                      <div style={{ fontSize:10, color:'var(--text2)', marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:17, fontWeight:700, fontFamily:'monospace', color: color as string }}>{val}</div>
                      {sub && <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{sub}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={S.card}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>💵 Efectivo vs 💳 Tarjeta</div>
                    {[['💵 Efectivo', data.summary.efectivo],['💳 Tarjeta', data.summary.tarjeta]].map(([label, val]) => (
                      <div key={label as string} style={{ marginBottom:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                          <span>{label}</span>
                          <span style={{ fontFamily:'monospace', fontWeight:600 }}>{fmt(val as number)} · {pct(val as number, data.summary.importe_bruto)}</span>
                        </div>
                        <div style={{ background:'var(--s3)', borderRadius:4, height:8 }}>
                          <div style={{ width:`${pct(val as number, data.summary.importe_bruto)}`, height:'100%', background:'var(--accent)', borderRadius:4, minWidth: (val as number)>0?2:0 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={S.card}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Top 5 productos</div>
                    {data.product_ranking.slice(0,5).map((p: any, i: number) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                        <span style={{ color:'var(--text2)' }}><b style={{ color:'var(--accent)' }}>#{i+1}</b> {p.name}</span>
                        <span style={{ fontFamily:'monospace', color:'var(--green)' }}>{fmt(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PRODUCTOS ── */}
            {activeTab === 'productos' && (
              <div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>🏆 Ranking de productos más vendidos</div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>
                    {['#','Producto','Uds. vendidas','Total (€)','% del total','Régimen'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.product_ranking.map((p: any, i: number) => (
                      <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={{ ...S.td, fontWeight:700, color:'var(--text3)', width:30 }}>#{i+1}</td>
                        <td style={{ ...S.td, fontWeight:600 }}>{p.name}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right' }}>{p.qty}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--green)', textAlign:'right' }}>{fmt(p.total)}</td>
                        <td style={{ ...S.td }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1, background:'var(--s3)', borderRadius:3, height:6 }}>
                              <div style={{ width:pct(p.total, data.summary.importe_bruto), height:'100%', background:'var(--accent)', borderRadius:3, minWidth:p.total>0?2:0 }} />
                            </div>
                            <span style={{ fontSize:10, color:'var(--text2)', width:36, textAlign:'right' }}>{pct(p.total, data.summary.importe_bruto)}</span>
                          </div>
                        </td>
                        <td style={S.td}>
                          <span style={{ fontSize:9, padding:'1px 6px', borderRadius:3, fontWeight:600,
                            background: p.regime==='rebu'?'var(--teal-dim)':'var(--accent-dim)',
                            color: p.regime==='rebu'?'var(--teal)':'var(--accent)' }}>
                            {p.regime==='rebu'?'REBU':'IVA'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!data.product_ranking.length && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text3)', padding:30 }}>Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── CATEGORÍAS ── */}
            {activeTab === 'categorias' && (
              <div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>🏷️ Ventas por categoría</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>
                      {['Categoría','Uds.','Total (€)','%'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.category_breakdown.map((c: any, i: number) => {
                        const cat = categories.find((x:any) => String(x.id) === c.name)
                        return (
                          <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                            <td style={{ ...S.td, fontWeight:600 }}>{cat ? `${cat.icon} ${cat.name}` : '📦 Sin categoría'}</td>
                            <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right' }}>{c.qty}</td>
                            <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--green)', textAlign:'right' }}>{fmt(c.total)}</td>
                            <td style={{ ...S.td, fontSize:11, color:'var(--text2)' }}>{pct(c.total, data.summary.importe_bruto)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={S.card}>
                    <div style={{ fontSize:12, fontWeight:600, marginBottom:12 }}>Distribución por categoría</div>
                    <BarChart
                      data={data.category_breakdown.map((c:any) => {
                        const cat = categories.find((x:any) => String(x.id) === c.name)
                        return { ...c, label: cat ? `${cat.icon} ${cat.name}` : 'Sin cat.' }
                      })}
                      valueKey="total" labelKey="label" />
                  </div>
                </div>
              </div>
            )}

            {/* ── CAJEROS ── */}
            {activeTab === 'cajeros' && (
              <div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>👤 Comparativa por cajero</div>
                <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:16 }}>
                  <thead><tr>
                    {['Cajero','Nº Ventas','Total','Efectivo','Tarjeta','% del total'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.cashier_breakdown.map((c: any, i: number) => (
                      <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={{ ...S.td, fontWeight:600 }}>👤 {c.name}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right' }}>{c.ventas}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--green)', textAlign:'right' }}>{fmt(c.total)}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right', color:'var(--green)' }}>{fmt(c.efectivo)}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right', color:'var(--accent)' }}>{fmt(c.tarjeta)}</td>
                        <td style={S.td}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ flex:1, background:'var(--s3)', borderRadius:3, height:6 }}>
                              <div style={{ width:pct(c.total, data.summary.importe_bruto), height:'100%', background:'var(--teal)', borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:10, color:'var(--text2)', width:36 }}>{pct(c.total, data.summary.importe_bruto)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!data.cashier_breakdown.length && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--text3)', padding:30 }}>Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── EVOLUCIÓN ── */}
            {activeTab === 'evolucion' && (
              <div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>📈 Evolución diaria de ventas</div>
                {data.daily_evolution.length > 0 && (
                  <div style={{ ...S.card, marginBottom:16 }}>
                    <div style={{ fontSize:11, color:'var(--text2)', marginBottom:10 }}>Importe por día (€)</div>
                    <BarChart data={data.daily_evolution} valueKey="total" labelKey="date" maxBars={31} />
                  </div>
                )}
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>
                    {['Fecha','Nº Ventas','Total (€)','Base (€)','IVA (€)'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.daily_evolution.map((d: any, i: number) => (
                      <tr key={i} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={{ ...S.td, fontWeight:600 }}>{d.date}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right' }}>{d.ventas}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--green)', textAlign:'right' }}>{fmt(d.total)}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right' }}>{fmt(d.base)}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right', color:'var(--amber)' }}>{fmt(d.iva)}</td>
                      </tr>
                    ))}
                    {!data.daily_evolution.length && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--text3)', padding:30 }}>Sin datos para el período</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── IVA / MOD 303 ── */}
            {activeTab === 'iva' && (
              <div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>🧾 Resumen de IVA — Modelo 303</div>
                <div style={{ fontSize:11, color:'var(--text2)', marginBottom:16 }}>
                  Período: {filters.from} — {filters.to} · {NEGOCIO.nombre} · NIF {NEGOCIO.nif}
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', maxWidth:600 }}>
                  <thead><tr>
                    {['Tipo IVA','Base imponible','Cuota IVA','Total bruto'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {Object.entries(data.iva_breakdown).map(([k, v]: any) => (
                      <tr key={k} onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                        <td style={{ ...S.td, fontWeight:700 }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:700,
                            background: k==='rebu'?'var(--teal-dim)':'var(--accent-dim)',
                            color: k==='rebu'?'var(--teal)':'var(--accent)' }}>
                            {k==='rebu'?'REBU (margen)':k+'%'}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontFamily:'monospace', textAlign:'right' }}>{fmt(v.base)}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--amber)', textAlign:'right' }}>{fmt(v.cuota)}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--green)', textAlign:'right' }}>{fmt(v.total)}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'var(--s3)' }}>
                      <td style={{ ...S.td, fontWeight:700 }}>TOTALES</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, textAlign:'right' }}>{fmt(data.summary.base_imponible)}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--amber)', textAlign:'right' }}>{fmt(data.summary.iva_total)}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontWeight:700, color:'var(--green)', textAlign:'right' }}>{fmt(data.summary.importe_bruto)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ ...S.card, marginTop:16, fontSize:12, color:'var(--text2)', lineHeight:1.8, maxWidth:600 }}>
                  <b style={{ color:'var(--amber)' }}>Nota fiscal:</b> Estos datos deben trasladarse a la declaración trimestral (Mod. 303).
                  Conservar los registros mínimo 4 años (LGT Art. 66-68).
                  {data.iva_breakdown.rebu && <><br/><b style={{ color:'var(--teal)' }}>REBU:</b> Los artículos REBU tributan solo sobre el margen de beneficio (Art. 135-139 LIVA). Declarar en Mod. 309 separado del Mod. 303.</>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'var(--green)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, zIndex:999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
