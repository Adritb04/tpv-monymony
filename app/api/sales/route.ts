export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest } from '@/lib/auth'
import { addLog } from '@/lib/log'
import { computeHash, GENESIS_HASH } from '@/lib/hash'
import { NEGOCIO, SW_NAME, SW_VERSION } from '@/lib/config'
import { SaleItem } from '@/types'

function baseFromPrice(price: number, ivaRate: number) {
  return price / (1 + ivaRate / 100)
}

function buildIvaBreakdown(items: SaleItem[]) {
  const groups: Record<string, { base: number; iva: number; total: number }> = {}
  let totalBase = 0, totalIva = 0

  for (const item of items) {
    const lineTotal = item.price * item.qty
    if (item.regime === 'rebu') {
      const unitMargin = Math.max(0, item.price - (item.cost_price || 0))
      const totalMargin = unitMargin * item.qty
      const ivaOnMargin = totalMargin * (item.iva_rate || 21) / (100 + (item.iva_rate || 21))
      if (!groups.rebu) groups.rebu = { base: 0, iva: 0, total: 0 }
      groups.rebu.base  += totalMargin
      groups.rebu.iva   += ivaOnMargin
      groups.rebu.total += lineTotal
      totalIva  += ivaOnMargin
      totalBase += lineTotal - ivaOnMargin
    } else {
      const rate = String(item.iva_rate || 21)
      const base = baseFromPrice(lineTotal, item.iva_rate || 21)
      const iva  = lineTotal - base
      if (!groups[rate]) groups[rate] = { base: 0, iva: 0, total: 0 }
      groups[rate].base  += base
      groups[rate].iva   += iva
      groups[rate].total += lineTotal
      totalBase += base
      totalIva  += iva
    }
  }
  return { groups, totalBase, totalIva, total: totalBase + totalIva }
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page  = parseInt(searchParams.get('page')  || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const pay   = searchParams.get('pay')   || ''
  const type  = searchParams.get('type')  || ''
  const q     = searchParams.get('q')     || ''
  const from  = parseInt(searchParams.get('from') || '0')
  const to    = parseInt(searchParams.get('to')   || '0')
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('sales')
    .select('*', { count: 'exact' })
    .order('ts', { ascending: false })
    .range(offset, offset + limit - 1)

  if (pay)  query = query.eq('pay', pay)
  if (type) query = query.eq('type', type)
  if (q)    query = query.ilike('ticket_id', `%${q}%`)
  if (from) query = query.gte('ts', from)
  if (to)   query = query.lte('ts', to)

  // Cajero only sees their own sales
  if (auth.role === 'cajero') query = query.eq('cashier_id', auth.userId)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const items: SaleItem[] = body.items
  const pay: string = body.pay || 'efectivo'

  if (!items?.length) return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 })

  const { groups, totalBase, totalIva, total } = buildIvaBreakdown(items)

  // Get latest ticket counter and last hash — atomically
  const { data: lastSale } = await supabaseAdmin
    .from('sales')
    .select('id, ticket_id, hash')
    .order('ts', { ascending: false })
    .limit(1)
    .single()

  const prevHash = lastSale?.hash || GENESIS_HASH

  // Get new ticket number
  const { data: counter } = await supabaseAdmin
    .from('ticket_counter')
    .select('val')
    .eq('id', 1)
    .single()

  const newCount = (counter?.val || 1000) + 1
  const ticketId = `${NEGOCIO.serie}-${String(newCount).padStart(6, '0')}`

  const now = new Date()
  const ts  = now.getTime()
  const hash = computeHash(prevHash, ticketId, NEGOCIO.nif, total, ts)

  const sale = {
    ticket_id:    ticketId,
    type:         'venta',
    date:         now.toLocaleDateString('es-ES'),
    time:         now.toLocaleTimeString('es-ES'),
    ts,
    items,
    iva_breakdown: groups,
    base:          totalBase,
    iva_total:     totalIva,
    total,
    pay,
    cashier_id:   auth.userId,
    cashier_name: auth.name,
    nif:          NEGOCIO.nif,
    razon_social: NEGOCIO.nombre,
    hash,
    prev_hash:    prevHash,
    sw_name:      SW_NAME,
    sw_version:   SW_VERSION,
  }

  const { data: saved, error } = await supabaseAdmin
    .from('sales')
    .insert(sale)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Increment counter
  await supabaseAdmin.from('ticket_counter').update({ val: newCount }).eq('id', 1)

  // Reduce stock
  for (const item of items) {
    await supabaseAdmin.rpc('decrement_stock', { p_id: item.product_id, p_qty: item.qty })
  }

  await addLog('venta', `Venta ${ticketId}`, `${total.toFixed(2)}€ · ${pay} · ${items.length} producto(s)`, auth)

  return NextResponse.json({ data: saved })
}
