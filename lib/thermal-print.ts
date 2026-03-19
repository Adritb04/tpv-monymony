// ── Thermal print helper ─────────────────────────────────────────
// Tries QZ Tray first (silent), falls back to window.print()

import { isQZAvailable, printThermal } from './qz-print'

const NEGOCIO = {
  nombre:    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE    || 'MI TIENDA',
  nif:       process.env.NEXT_PUBLIC_NEGOCIO_NIF       || 'B00000000',
  direccion: process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION || 'Calle Mayor, 1',
  cp:        process.env.NEXT_PUBLIC_NEGOCIO_CP        || '28001',
  localidad: process.env.NEXT_PUBLIC_NEGOCIO_LOCALIDAD || 'Madrid',
  telefono:  process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO  || '',
}

const fmtN = (n: number) => (n || 0).toFixed(2)
const center = (text: string, width = 42) => {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(pad) + text
}
const left = (l: string, r: string, width = 42) => {
  const space = Math.max(1, width - l.length - r.length)
  return l + ' '.repeat(space) + r
}
const divider = (char = '-', width = 42) => char.repeat(width)

// Build plain text ticket for ESC/POS
export function buildEscPosLines(s: any): string[] {
  const isRect = s.type === 'rectificativo'
  const bd = s.iva_breakdown || {}
  const lines: string[] = []

  // Header
  lines.push(center(s.razon_social || NEGOCIO.nombre))
  lines.push(center(`NIF: ${s.nif || NEGOCIO.nif}`))
  lines.push(center(NEGOCIO.direccion))
  lines.push(center(`${NEGOCIO.cp} ${NEGOCIO.localidad}`))
  if (NEGOCIO.telefono) lines.push(center(`Tel: ${NEGOCIO.telefono}`))
  lines.push(divider())

  if (isRect) {
    lines.push(center('*** FACTURA RECTIFICATIVA ***'))
    lines.push(left('Rectifica:', s.rect_of))
    lines.push(`Motivo: ${s.rect_reason}`)
    lines.push(divider())
  }

  lines.push(isRect ? 'FACTURA RECTIFICATIVA' : 'FACTURA SIMPLIFICADA')
  lines.push(left('Ticket:', s.ticket_id))
  lines.push(left('Fecha:', `${s.date} ${s.time}`))
  lines.push(left('Cajero:', s.cashier_name))
  lines.push(divider())

  // Items
  ;(s.items || []).forEach((i: any) => {
    const lt = i.line_total || i.price * i.qty
    lines.push(left(`${i.name} x${i.qty}`, `${fmtN(lt)} EUR`))
    lines.push(`  ${i.regime === 'rebu' ? 'REBU' : 'IVA ' + i.iva_rate + '%'}`)
  })
  lines.push(divider())

  // IVA breakdown
  ;[4, 10, 21].forEach(r => {
    const g = bd[String(r)]
    if (g?.base > 0) {
      lines.push(left(`Base IVA ${r}%:`, `${fmtN(g.base)} EUR`))
      lines.push(left(`Cuota IVA ${r}%:`, `${fmtN(g.iva)} EUR`))
    }
  })
  const rebu = bd.rebu
  if (rebu?.total > 0) {
    lines.push(left('Arts. REBU:', `${fmtN(rebu.total)} EUR`))
    lines.push('  IVA incl. no deducible (Art.135-139 LIVA)')
  }
  if (Object.keys(bd).length) lines.push(divider())

  lines.push(left('Base imponible:', `${fmtN(Math.abs(s.base))} EUR`))
  lines.push(left('IVA total:', `${fmtN(Math.abs(s.iva_total))} EUR`))
  lines.push(divider('='))
  lines.push(center(`TOTAL: ${isRect ? '-' : ''}${fmtN(Math.abs(s.total))} EUR`))
  lines.push(left('Pago:', s.pay === 'efectivo' ? 'Efectivo' : 'Tarjeta'))
  lines.push(divider())
  lines.push(`Hash: ${(s.hash || '').substring(0, 20)}...`)
  lines.push(center('*** Gracias por su compra ***'))

  return lines
}

// Main print function — QZ Tray if available, else window.print()
export async function printTicketAuto(
  s: any,
  buildHTMLFn: (s: any) => string,
  silent = false
): Promise<void> {
  // Try QZ Tray first
  const qzOk = await isQZAvailable()
  if (qzOk) {
    const lines = buildEscPosLines(s)
    const printed = await printThermal(lines)
    if (printed) return // Success — done silently
  }

  // Fallback: window.print() with thermal CSS
  const w = window.open('', '_blank', 'width=302,height=600,menubar=no,toolbar=no,location=no,status=no')!
  w.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Ticket ${s.ticket_id}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; width: 72mm; padding: 3mm 2mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .row { display: flex; justify-content: space-between; margin: 1px 0; }
  .divider { border-top: 1px dashed #000; margin: 3px 0; }
  .divider-solid { border-top: 2px solid #000; margin: 3px 0; }
  .total { font-size: 14px; font-weight: bold; text-align: center; margin: 2px 0; }
  .small { font-size: 9px; }
  .hash { font-size: 7px; word-break: break-all; }
</style>
</head><body>
${buildHTMLFn(s)}
</body></html>`)
  w.document.close()
  if (silent) {
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 500) }, 350)
  } else {
    setTimeout(() => { w.print() }, 350)
  }
}
