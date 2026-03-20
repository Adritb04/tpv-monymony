export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from      = searchParams.get('from') || ''
  const to        = searchParams.get('to')   || ''
  const cashier   = searchParams.get('cashier') || ''
  const pay       = searchParams.get('pay') || ''
  const regime    = searchParams.get('regime') || ''
  const category  = searchParams.get('category') || ''
  const product   = searchParams.get('product') || ''
  const type      = searchParams.get('type') || '' // 'venta' | 'rectificativo' | '' = all

  // Build timestamp range from date strings
  const fromTs = from ? new Date(from + 'T00:00:00').getTime() : 0
  const toTs   = to   ? new Date(to   + 'T23:59:59').getTime() : Date.now()

  // ── Fetch all sales in range ──
  let query = supabaseAdmin
    .from('sales')
    .select('*')
    .gte('ts', fromTs)
    .lte('ts', toTs)
    .order('ts', { ascending: false })

  if (cashier) query = query.eq('cashier_name', cashier)
  if (pay)     query = query.eq('pay', pay)
  if (type)    query = query.eq('type', type)

  const { data: sales, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let filtered = sales || []

  // Filter by regime (requires checking items)
  if (regime) {
    filtered = filtered.filter(s =>
      (s.items || []).some((i: any) => i.regime === regime)
    )
  }

  // Filter by category_id
  if (category) {
    filtered = filtered.filter(s =>
      (s.items || []).some((i: any) => String(i.category_id) === category)
    )
  }

  // Filter by product name (partial match)
  if (product) {
    const q = product.toLowerCase()
    filtered = filtered.filter(s =>
      (s.items || []).some((i: any) => i.name?.toLowerCase().includes(q))
    )
  }

  // ── Aggregate ──
  const ventas = filtered.filter(s => s.type !== 'rectificativo')
  const rects  = filtered.filter(s => s.type === 'rectificativo')

  const totalVentas   = ventas.reduce((a: number, s: any) => a + parseFloat(s.total), 0)
  const totalRects    = Math.abs(rects.reduce((a: number, s: any) => a + parseFloat(s.total), 0))
  const totalBase     = ventas.reduce((a: number, s: any) => a + parseFloat(s.base || 0), 0)
  const totalIva      = ventas.reduce((a: number, s: any) => a + parseFloat(s.iva_total || 0), 0)
  const totalEfectivo = ventas.filter(s => s.pay === 'efectivo').reduce((a: number, s: any) => a + parseFloat(s.total), 0)
  const totalTarjeta  = ventas.filter(s => s.pay === 'tarjeta').reduce((a: number, s: any) => a + parseFloat(s.total), 0)

  // ── IVA breakdown for Mod. 303 ──
  const ivaBreakdown: Record<string, { base: number; cuota: number; total: number }> = {}
  ventas.forEach((s: any) => {
    const bd = s.iva_breakdown || {}
    ;[4, 10, 21].forEach(r => {
      const g = bd[String(r)]
      if (g?.base > 0) {
        if (!ivaBreakdown[String(r)]) ivaBreakdown[String(r)] = { base: 0, cuota: 0, total: 0 }
        ivaBreakdown[String(r)].base  += g.base
        ivaBreakdown[String(r)].cuota += g.iva
        ivaBreakdown[String(r)].total += g.total
      }
    })
    const rebu = bd.rebu
    if (rebu?.total > 0) {
      if (!ivaBreakdown.rebu) ivaBreakdown.rebu = { base: 0, cuota: 0, total: 0 }
      ivaBreakdown.rebu.base  += rebu.margin || 0
      ivaBreakdown.rebu.cuota += rebu.iva    || 0
      ivaBreakdown.rebu.total += rebu.total  || 0
    }
  })

  // ── Product ranking ──
  const productMap: Record<string, { name: string; qty: number; total: number; category_id: number | null; regime: string }> = {}
  ventas.forEach((s: any) => {
    ;(s.items || []).forEach((i: any) => {
      if (!productMap[i.name]) productMap[i.name] = { name: i.name, qty: 0, total: 0, category_id: i.category_id || null, regime: i.regime || 'iva' }
      productMap[i.name].qty   += i.qty || 1
      productMap[i.name].total += i.line_total || (i.price * (i.qty || 1))
    })
  })
  const productRanking = Object.values(productMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)

  // ── Category breakdown ──
  const categoryMap: Record<string, { name: string; qty: number; total: number }> = {}
  ventas.forEach((s: any) => {
    ;(s.items || []).forEach((i: any) => {
      const key = String(i.category_id || 'sin_categoria')
      if (!categoryMap[key]) categoryMap[key] = { name: key, qty: 0, total: 0 }
      categoryMap[key].qty   += i.qty || 1
      categoryMap[key].total += i.line_total || (i.price * (i.qty || 1))
    })
  })

  // ── Cashier breakdown ──
  const cashierMap: Record<string, { name: string; ventas: number; total: number; efectivo: number; tarjeta: number }> = {}
  ventas.forEach((s: any) => {
    const k = s.cashier_name
    if (!cashierMap[k]) cashierMap[k] = { name: k, ventas: 0, total: 0, efectivo: 0, tarjeta: 0 }
    cashierMap[k].ventas++
    cashierMap[k].total += parseFloat(s.total)
    if (s.pay === 'efectivo') cashierMap[k].efectivo += parseFloat(s.total)
    else cashierMap[k].tarjeta += parseFloat(s.total)
  })

  // ── Daily evolution ──
  const dailyMap: Record<string, { date: string; ventas: number; total: number; base: number; iva: number }> = {}
  ventas.forEach((s: any) => {
    const d = s.date || ''
    if (!dailyMap[d]) dailyMap[d] = { date: d, ventas: 0, total: 0, base: 0, iva: 0 }
    dailyMap[d].ventas++
    dailyMap[d].total += parseFloat(s.total)
    dailyMap[d].base  += parseFloat(s.base || 0)
    dailyMap[d].iva   += parseFloat(s.iva_total || 0)
  })
  const dailyEvolution = Object.values(dailyMap).sort((a, b) => {
    const [da, ma, ya] = a.date.split('/').map(Number)
    const [db, mb, yb] = b.date.split('/').map(Number)
    return new Date(ya, ma-1, da).getTime() - new Date(yb, mb-1, db).getTime()
  })

  return NextResponse.json({
    data: {
      summary: {
        total_ventas: ventas.length,
        total_rects:  rects.length,
        importe_bruto: totalVentas,
        importe_rects: totalRects,
        importe_neto:  totalVentas - totalRects,
        base_imponible: totalBase,
        iva_total: totalIva,
        efectivo: totalEfectivo,
        tarjeta: totalTarjeta,
      },
      iva_breakdown: ivaBreakdown,
      product_ranking: productRanking,
      category_breakdown: Object.values(categoryMap).sort((a,b) => b.total - a.total),
      cashier_breakdown: Object.values(cashierMap).sort((a,b) => b.total - a.total),
      daily_evolution: dailyEvolution,
    }
  })
}
