'use client'

import { useState, useEffect, useCallback } from 'react'

const fmt  = (n: number) => (n || 0).toFixed(2).replace('.', ',') + ' €'
const fmtN = (n: number) => (n || 0).toFixed(2).replace('.', ',')

const NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE    || 'MI TIENDA',
  nif:       process.env.NEXT_PUBLIC_NEGOCIO_NIF       || 'B00000000',
  direccion: process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION || 'Calle Mayor, 1',
  cp:        process.env.NEXT_PUBLIC_NEGOCIO_CP        || '28001',
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD || 'Madrid',
}

const S = {
  card:   { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  input:  { background:'var(--s2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'inherit', fontSize:14, outline:'none', width:'100%' },
  label:  { fontSize:10, color:'var(--text2)', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.05em', display:'block', marginBottom:4 },
  btn:    (bg='var(--accent)', color='#fff') => ({ padding:'10px 18px', borderRadius:8, border:'none', background:bg, color, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }),
  btnOut: { padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'none', color:'var(--text2)', cursor:'pointer', fontSize:12, fontFamily:'inherit' },
  badge:  (c: string, bg: string) => ({ display:'inline-flex', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, color:c, background:bg }),
}

interface CashRegisterProps {
  token: string
  user: any
  onCajaChange?: () => void
}

export default function CashRegister({ token, user, onCajaChange }: CashRegisterProps) {
  const [registers, setRegisters]   = useState<any[]>([])
  const [openCaja, setOpenCaja]     = useState<any>(null)
  const [loading, setLoading]       = useState(false)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [view, setView]             = useState<'main' | 'apertura' | 'cierre'>('main')

  // Forms
  const [fondoInicial, setFondoInicial] = useState('')
  const [notesAp, setNotesAp]           = useState('')
  const [realContado, setRealContado]   = useState('')
  const [notesCierre, setNotesCierre]   = useState('')

  // Coin/bill counter
  const DENOMINATIONS = [
    { value: 500,  label: '500 €',   type: 'billete' },
    { value: 200,  label: '200 €',   type: 'billete' },
    { value: 100,  label: '100 €',   type: 'billete' },
    { value: 50,   label: '50 €',    type: 'billete' },
    { value: 20,   label: '20 €',    type: 'billete' },
    { value: 10,   label: '10 €',    type: 'billete' },
    { value: 5,    label: '5 €',     type: 'billete' },
    { value: 2,    label: '2 €',     type: 'moneda' },
    { value: 1,    label: '1 €',     type: 'moneda' },
    { value: 0.50, label: '0,50 €',  type: 'moneda' },
    { value: 0.20, label: '0,20 €',  type: 'moneda' },
    { value: 0.10, label: '0,10 €',  type: 'moneda' },
    { value: 0.05, label: '0,05 €',  type: 'moneda' },
    { value: 0.02, label: '0,02 €',  type: 'moneda' },
    { value: 0.01, label: '0,01 €',  type: 'moneda' },
  ]
  const [counts, setCounts]       = useState<Record<string, string>>({})
  const [countsAp, setCountsAp]   = useState<Record<string, string>>({})

  const totalContado = DENOMINATIONS.reduce((sum, d) => {
    const c = parseFloat(counts[String(d.value)] || '0') || 0
    return sum + c * d.value
  }, 0)

  const totalApertura = DENOMINATIONS.reduce((sum, d) => {
    const c = parseFloat(countsAp[String(d.value)] || '0') || 0
    return sum + c * d.value
  }, 0)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cash-register?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const j = await res.json()
      const data: any[] = j.data || []
      setRegisters(data)
      // Find open caja
      const open = data.find(r => r.status === 'abierto')
      setOpenCaja(open || null)
    } catch (e: any) { showToast(e.message, false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const doApertura = async () => {
    if (!fondoInicial && fondoInicial !== '0') return showToast('Introduce el fondo inicial', false)
    setLoading(true)
    try {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'apertura', fondo_inicial: parseFloat(fondoInicial) || 0, notes: notesAp }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Caja abierta')
      setFondoInicial(''); setNotesAp(''); setView('main')
      load()
      onCajaChange?.()
    } catch (e: any) { showToast(e.message, false) }
    finally { setLoading(false) }
  }

  const doCierre = async () => {
    if (!realContado) return showToast('Introduce el importe real contado', false)
    if (!openCaja) return showToast('No hay caja abierta', false)
    setLoading(true)
    try {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'cierre', apertura_id: openCaja.id, real_contado: parseFloat(realContado), notes: notesCierre }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      showToast('✓ Caja cerrada')
      onCajaChange?.()
      // Print PDF
      printArqueoPDF(j.data)
      setRealContado(''); setNotesCierre(''); setView('main')
      load()
    } catch (e: any) { showToast(e.message, false) }
    finally { setLoading(false) }
  }

  const printArqueoPDF = (r: any) => {
    const diferencia = parseFloat(r.diferencia)
    const difColor = diferencia === 0 ? '#000' : diferencia > 0 ? '#2b8a3e' : '#c92a2a'
    const difText  = diferencia === 0 ? 'CUADRADA' : diferencia > 0 ? `SOBRANTE +${fmtN(Math.abs(diferencia))} €` : `FALTANTE -${fmtN(Math.abs(diferencia))} €`

    const w = window.open('', '_blank', 'width=700,height=900')!
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Arqueo de Caja</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:16px;font-weight:600;color:#000;padding:24px}
      h1{font-size:22px;font-weight:800;margin-bottom:2px}
      h2{font-size:17px;font-weight:700;margin:14px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px}
      .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:16px;font-weight:600}
      .row.total{font-weight:800;font-size:18px;border-top:2px solid #000;border-bottom:none;padding-top:6px;margin-top:2px}
      .row.dif{font-weight:800;font-size:19px;color:${difColor}}
      .box{border:1px solid #ddd;border-radius:6px;padding:12px;margin-bottom:12px}
      .box.ok{background:#f0fff4;border-color:#8ce99a}
      .box.warn{background:#fff9db;border-color:#ffd43b}
      .box.err{background:#fff5f5;border-color:#ffa8a8}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .sign-box{border:1px solid #999;border-radius:4px;min-height:60px;padding:8px;margin-top:6px}
      .signs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
      .footer{margin-top:20px;font-size:13px;font-weight:600;color:#666;border-top:1px solid #ccc;padding-top:8px}
      @media print{body{padding:12px}}
    </style></head><body>
    <div class="header">
      <div>
        <h1>${NEGOCIO.nombre}</h1>
        <div>NIF: ${NEGOCIO.nif} · ${NEGOCIO.direccion}, ${NEGOCIO.cp} ${NEGOCIO.localidad}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:700">ARQUEO DE CAJA</div>
        <div>Apertura: ${r.opened_at ? new Date(r.opened_at).toLocaleString('es-ES') : '-'}</div>
        <div>Cierre: ${r.closed_at ? new Date(r.closed_at).toLocaleString('es-ES') : '-'}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#666;text-transform:uppercase">Apertura</h2>
        <div class="row"><span>Fondo inicial</span><span><b>${fmtN(parseFloat(r.fondo_inicial))} €</b></span></div>
        <div class="row"><span>Abierta por</span><span>${r.opened_by_name}</span></div>
      </div>
      <div class="box">
        <h2 style="margin-top:0;border:none;font-size:11px;color:#666;text-transform:uppercase">Cierre</h2>
        <div class="row"><span>Cerrada por</span><span>${r.closed_by_name}</span></div>
        ${r.notes ? `<div class="row"><span>Notas</span><span>${r.notes}</span></div>` : ''}
      </div>
    </div>

    <h2>Ventas del turno</h2>
    <div class="box">
      <div class="row"><span>Ventas en efectivo</span><span>${fmtN(parseFloat(r.ventas_efectivo))} €</span></div>
      <div class="row"><span>Ventas con tarjeta</span><span>${fmtN(parseFloat(r.ventas_tarjeta))} €</span></div>
      <div class="row total"><span>TOTAL VENTAS</span><span>${fmtN(parseFloat(r.ventas_total))} €</span></div>
    </div>

    <h2>Cuadre de caja</h2>
    <div class="box ${diferencia === 0 ? 'ok' : diferencia > 0 ? 'warn' : 'err'}">
      <div class="row"><span>Fondo inicial</span><span>${fmtN(parseFloat(r.fondo_inicial))} €</span></div>
      <div class="row"><span>+ Ventas efectivo</span><span>${fmtN(parseFloat(r.ventas_efectivo))} €</span></div>
      <div class="row total"><span>ESPERADO EN CAJA</span><span>${fmtN(parseFloat(r.esperado))} €</span></div>
      <div class="row" style="margin-top:8px"><span>REAL CONTADO</span><span><b>${fmtN(parseFloat(r.real_contado))} €</b></span></div>
      <div class="row dif" style="margin-top:6px;padding-top:6px;border-top:2px solid #000">
        <span>DIFERENCIA</span><span>${difText}</span>
      </div>
    </div>

    <div class="signs">
      <div>
        <div style="font-size:10px;color:#888">Firma del cajero</div>
        <div class="sign-box"></div>
        <div style="font-size:10px;text-align:center;margin-top:4px">${r.closed_by_name}</div>
      </div>
      <div>
        <div style="font-size:10px;color:#888">Firma del responsable / Sello</div>
        <div class="sign-box"></div>
        <div style="font-size:10px;text-align:center;margin-top:4px">${NEGOCIO.nombre}</div>
      </div>
    </div>

    <div class="footer">
      TPV-Legal-ES · Documento generado el ${new Date().toLocaleString('es-ES')} · Conservar según normativa fiscal
    </div>
    </body></html>`)
    w.document.close()
    setTimeout(() => { w.print() }, 400)
  }

  const cajaDuration = (r: any) => {
    if (!r.opened_at) return '-'
    const from = new Date(r.opened_at)
    const to   = r.closed_at ? new Date(r.closed_at) : new Date()
    const mins = Math.floor((to.getTime() - from.getTime()) / 60000)
    const h = Math.floor(mins / 60), m = mins % 60
    return `${h}h ${m}m`
  }

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>

      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <span style={{ fontSize:16, fontWeight:700, marginRight:'auto' }}>💰 Arqueo de Caja</span>
        {view !== 'main' && (
          <button onClick={() => setView('main')} style={S.btnOut}>← Volver</button>
        )}
        {view === 'main' && !openCaja && (
          <button onClick={() => setView('apertura')} style={S.btn('var(--green)')}>+ Abrir caja</button>
        )}
        {view === 'main' && openCaja && (
          <button onClick={() => setView('cierre')} style={S.btn('var(--red)')}>Cerrar caja</button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', minHeight:0 }}>

        {/* APERTURA FORM */}
        {view === 'apertura' && (
          <div style={{ maxWidth:520 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'var(--green)' }}>🟢 Apertura de caja</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={S.label}>Conteo del fondo inicial — billetes y monedas</label>
                <div style={{ fontSize:10, color:'var(--text2)', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:6 }}>💵 Billetes</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
                  {DENOMINATIONS.filter(d => d.type === 'billete').map(d => (
                    <div key={d.value} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 6px', textAlign:'center' as const }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', marginBottom:4 }}>{d.label}</div>
                      <input
                        style={{ width:'100%', background:'var(--s1)', border:'1px solid var(--border)', borderRadius:5, padding:'5px 4px', color:'var(--text)', fontFamily:'monospace', fontSize:14, fontWeight:700, textAlign:'center' as const, outline:'none' }}
                        type="number" min="0" step="1"
                        value={countsAp[String(d.value)] || ''}
                        onChange={e => setCountsAp(p => ({ ...p, [String(d.value)]: e.target.value }))}
                        placeholder="0"
                      />
                      {(parseFloat(countsAp[String(d.value)] || '0') || 0) > 0 && (
                        <div style={{ fontSize:10, color:'var(--green)', marginTop:3, fontFamily:'monospace' }}>
                          = {((parseFloat(countsAp[String(d.value)] || '0') || 0) * d.value).toFixed(2).replace('.',',')} €
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'var(--text2)', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:6 }}>🪙 Monedas</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
                  {DENOMINATIONS.filter(d => d.type === 'moneda').map(d => (
                    <div key={d.value} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 6px', textAlign:'center' as const }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', marginBottom:4 }}>{d.label}</div>
                      <input
                        style={{ width:'100%', background:'var(--s1)', border:'1px solid var(--border)', borderRadius:5, padding:'5px 4px', color:'var(--text)', fontFamily:'monospace', fontSize:14, fontWeight:700, textAlign:'center' as const, outline:'none' }}
                        type="number" min="0" step="1"
                        value={countsAp[String(d.value)] || ''}
                        onChange={e => setCountsAp(p => ({ ...p, [String(d.value)]: e.target.value }))}
                        placeholder="0"
                      />
                      {(parseFloat(countsAp[String(d.value)] || '0') || 0) > 0 && (
                        <div style={{ fontSize:10, color:'var(--green)', marginTop:3, fontFamily:'monospace' }}>
                          = {((parseFloat(countsAp[String(d.value)] || '0') || 0) * d.value).toFixed(2).replace('.',',')} €
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ background:'var(--green-dim)', border:'1px solid rgba(62,207,142,.3)', borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:14, color:'var(--green)' }}>💰 Fondo inicial</span>
                  <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:22, color:'var(--green)' }}>{totalApertura.toFixed(2).replace('.',',')} €</span>
                </div>
              </div>
              <div>
                <label style={S.label}>Observaciones (opcional)</label>
                <input style={S.input} value={notesAp} onChange={e => setNotesAp(e.target.value)}
                  placeholder="Ej: Turno de mañana" />
              </div>
              <div style={{ ...S.card, fontSize:12, color:'var(--text2)' }}>
                <b style={{ color:'var(--text)' }}>¿Qué es el fondo inicial?</b><br/>
                El dinero en billetes y monedas que hay en la caja <b>antes</b> de empezar a vender.
                Al cerrar la caja, el sistema calculará cuánto debería haber y lo comparará con lo que cuentes.
              </div>
              <button onClick={doApertura} disabled={loading} style={{ ...S.btn('var(--green)'), width:'100%', padding:12 }}>
                {loading ? '...' : '🟢 Abrir caja ahora'}
              </button>
            </div>
          </div>
        )}

        {/* CIERRE FORM */}
        {view === 'cierre' && openCaja && (
          <div style={{ maxWidth:520 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'var(--red)' }}>🔴 Cierre de caja</div>

            {/* Resumen apertura */}
            <div style={{ ...S.card, marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Datos de apertura</div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span>Fondo inicial</span>
                <span style={{ fontFamily:'monospace', fontWeight:700 }}>{fmt(parseFloat(openCaja.fondo_inicial))}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span>Abierta por</span>
                <span>{openCaja.opened_by_name}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span>Abierta a las</span>
                <span>{openCaja.opened_at ? new Date(openCaja.opened_at).toLocaleString('es-ES') : '-'}</span>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={S.label}>Conteo de caja — billetes y monedas</label>
                {/* Billetes */}
                <div style={{ fontSize:10, color:'var(--text2)', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:6 }}>💵 Billetes</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
                  {DENOMINATIONS.filter(d => d.type === 'billete').map(d => (
                    <div key={d.value} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 6px', textAlign:'center' as const }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', marginBottom:4 }}>{d.label}</div>
                      <input
                        style={{ width:'100%', background:'var(--s1)', border:'1px solid var(--border)', borderRadius:5, padding:'5px 4px', color:'var(--text)', fontFamily:'monospace', fontSize:14, fontWeight:700, textAlign:'center' as const, outline:'none' }}
                        type="number" min="0" step="1"
                        value={counts[String(d.value)] || ''}
                        onChange={e => setCounts(p => ({ ...p, [String(d.value)]: e.target.value }))}
                        placeholder="0"
                      />
                      {(parseFloat(counts[String(d.value)] || '0') || 0) > 0 && (
                        <div style={{ fontSize:10, color:'var(--green)', marginTop:3, fontFamily:'monospace' }}>
                          = {((parseFloat(counts[String(d.value)] || '0') || 0) * d.value).toFixed(2).replace('.',',')} €
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Monedas */}
                <div style={{ fontSize:10, color:'var(--text2)', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:6 }}>🪙 Monedas</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
                  {DENOMINATIONS.filter(d => d.type === 'moneda').map(d => (
                    <div key={d.value} style={{ background:'var(--s2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 6px', textAlign:'center' as const }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'var(--teal)', marginBottom:4 }}>{d.label}</div>
                      <input
                        style={{ width:'100%', background:'var(--s1)', border:'1px solid var(--border)', borderRadius:5, padding:'5px 4px', color:'var(--text)', fontFamily:'monospace', fontSize:14, fontWeight:700, textAlign:'center' as const, outline:'none' }}
                        type="number" min="0" step="1"
                        value={counts[String(d.value)] || ''}
                        onChange={e => setCounts(p => ({ ...p, [String(d.value)]: e.target.value }))}
                        placeholder="0"
                      />
                      {(parseFloat(counts[String(d.value)] || '0') || 0) > 0 && (
                        <div style={{ fontSize:10, color:'var(--green)', marginTop:3, fontFamily:'monospace' }}>
                          = {((parseFloat(counts[String(d.value)] || '0') || 0) * d.value).toFixed(2).replace('.',',')} €
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Total contado */}
                <div style={{ background:'var(--green-dim)', border:'1px solid rgba(62,207,142,.3)', borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:14, color:'var(--green)' }}>💰 Total contado</span>
                  <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:22, color:'var(--green)' }}>{totalContado.toFixed(2).replace('.',',')} €</span>
                </div>
              </div>

              {/* Preview diferencia en tiempo real */}
              {totalContado > 0 && openCaja && (() => {
                const real = totalContado
                const fondo = parseFloat(openCaja.fondo_inicial)
                const estimatedCash = real - fondo
                return (
                  <div style={{ ...S.card, background:'var(--s3)', fontSize:12, color:'var(--text2)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span>Fondo inicial</span><span>{fmt(fondo)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span>Cobros efectivo estimados</span>
                      <span style={{ color:'var(--green)' }}>{fmt(Math.max(0, estimatedCash))}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, color:'var(--text)', fontSize:13, borderTop:'1px solid var(--border)', paddingTop:6, marginTop:4 }}>
                      <span>Real contado</span><span style={{ fontFamily:'monospace' }}>{fmt(real)}</span>
                    </div>
                  </div>
                )
              })()}

              <div>
                <label style={S.label}>Observaciones (opcional)</label>
                <input style={S.input} value={notesCierre} onChange={e => setNotesCierre(e.target.value)}
                  placeholder="Ej: Sin incidencias" />
              </div>

              <button onClick={doCierre} disabled={loading} style={{ ...S.btn('var(--red)'), width:'100%', padding:12 }}>
                {loading ? '...' : '🔴 Cerrar caja y generar PDF'}
              </button>
            </div>
          </div>
        )}

        {/* MAIN — Estado actual + historial */}
        {view === 'main' && (
          <>
            {/* Estado actual */}
            <div style={{ marginBottom:20 }}>
              {openCaja ? (
                <div style={{ ...S.card, border:'1px solid rgba(62,207,142,.4)', background:'var(--green-dim)', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:20 }}>🟢</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--green)' }}>Caja abierta</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>
                        Abierta por {openCaja.opened_by_name} · {openCaja.opened_at ? new Date(openCaja.opened_at).toLocaleString('es-ES') : '-'} · {cajaDuration(openCaja)}
                      </div>
                    </div>
                    <div style={{ marginLeft:'auto', textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>Fondo inicial</div>
                      <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color:'var(--green)' }}>{fmt(parseFloat(openCaja.fondo_inicial))}</div>
                    </div>
                  </div>
                  <button onClick={() => setView('cierre')} style={{ ...S.btn('var(--red)'), width:'100%' }}>
                    🔴 Cerrar caja
                  </button>
                </div>
              ) : (
                <div style={{ ...S.card, border:'1px solid rgba(240,62,62,.3)', background:'var(--red-dim)', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:20 }}>🔴</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--red)' }}>Caja cerrada</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>No hay ninguna caja abierta en este momento</div>
                    </div>
                  </div>
                  <button onClick={() => setView('apertura')} style={{ ...S.btn('var(--green)'), width:'100%' }}>
                    🟢 Abrir caja
                  </button>
                </div>
              )}
            </div>

            {/* Historial */}
            <div>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                Historial de arqueos
              </div>
              {!registers.filter(r => r.status === 'cerrado').length && (
                <div style={{ textAlign:'center', color:'var(--text3)', padding:30, fontSize:13 }}>Sin arqueos anteriores</div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {registers.filter(r => r.status === 'cerrado').map(r => {
                  const dif = parseFloat(r.diferencia)
                  const difColor = dif === 0 ? 'var(--green)' : dif > 0 ? 'var(--teal)' : 'var(--red)'
                  const difBg    = dif === 0 ? 'var(--green-dim)' : dif > 0 ? 'var(--teal-dim)' : 'var(--red-dim)'
                  return (
                    <div key={r.id} style={S.card}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600 }}>
                            {r.opened_at ? new Date(r.opened_at).toLocaleDateString('es-ES') : '-'} · {r.opened_by_name}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text2)' }}>
                            {r.opened_at ? new Date(r.opened_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : '-'} → {r.closed_at ? new Date(r.closed_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : '-'} · {cajaDuration(r)}
                          </div>
                        </div>
                        <span style={S.badge(difColor, difBg)}>
                          {dif === 0 ? '✓ Cuadrada' : dif > 0 ? `+${fmtN(Math.abs(dif))} €` : `-${fmtN(Math.abs(dif))} €`}
                        </span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                        {[
                          ['Fondo', fmt(parseFloat(r.fondo_inicial)), 'var(--text)'],
                          ['Ventas efect.', fmt(parseFloat(r.ventas_efectivo)), 'var(--green)'],
                          ['Esperado', fmt(parseFloat(r.esperado)), 'var(--text)'],
                          ['Real contado', fmt(parseFloat(r.real_contado)), difColor],
                        ].map(([label, val, color]) => (
                          <div key={label as string} style={{ background:'var(--s3)', borderRadius:6, padding:'6px 8px', textAlign:'center' }}>
                            <div style={{ fontSize:9, color:'var(--text3)', marginBottom:2 }}>{label}</div>
                            <div style={{ fontSize:11, fontWeight:700, fontFamily:'monospace', color: color as string }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:8, display:'flex', justifyContent:'flex-end' }}>
                        <button onClick={() => printArqueoPDF(r)} style={{ ...S.btnOut, fontSize:10, color:'var(--amber)', borderColor:'var(--amber-dim)' }}>
                          🖨️ Reimprimir PDF
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background: toast.ok ? 'var(--green)' : 'var(--red)', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, zIndex:999, boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
