export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { addLog } from '@/lib/log'
import { computeHash, GENESIS_HASH } from '@/lib/hash'
import { NEGOCIO, SW_NAME, SW_VERSION } from '@/lib/config'

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['encargado', 'admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { sale_id, reason } = await req.json()
  if (!sale_id || !reason?.trim())
    return NextResponse.json({ error: 'ID y motivo son obligatorios' }, { status: 400 })

  // Get original sale
  const { data: orig, error: origErr } = await supabaseAdmin
    .from('sales')
    .select('*')
    .eq('id', sale_id)
    .single()

  if (origErr || !orig) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
  if (orig.type === 'rectificativo') return NextResponse.json({ error: 'Ya es un rectificativo' }, { status: 400 })
  if (orig.rectified) return NextResponse.json({ error: 'Ya fue rectificado' }, { status: 400 })

  // Get last hash for chaining
  const { data: lastSale } = await supabaseAdmin
    .from('sales')
    .select('hash')
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

  const now  = new Date()
  const ts   = now.getTime()
  const total = -Math.abs(orig.total)
  const hash  = computeHash(prevHash, ticketId, NEGOCIO.nif, total, ts)

  const rect = {
    ticket_id:    ticketId,
    type:         'rectificativo',
    date:         now.toLocaleDateString('es-ES'),
    time:         now.toLocaleTimeString('es-ES'),
    ts,
    items:        orig.items,
    iva_breakdown: orig.iva_breakdown,
    base:          -Math.abs(orig.base),
    iva_total:     -Math.abs(orig.iva_total),
    total,
    pay:           orig.pay,
    cashier_id:    auth!.userId,
    cashier_name:  auth!.name,
    nif:           NEGOCIO.nif,
    razon_social:  NEGOCIO.nombre,
    rect_of:       orig.ticket_id,
    rect_reason:   reason.trim(),
    hash,
    prev_hash:     prevHash,
    sw_name:       SW_NAME,
    sw_version:    SW_VERSION,
  }

  const { data: saved, error } = await supabaseAdmin
    .from('sales')
    .insert(rect)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark original as rectified
  await supabaseAdmin.from('sales').update({
    rectified: true,
    rectified_by: auth!.username,
    rectified_at: now.toISOString(),
  }).eq('id', sale_id)

  // Restock items
  for (const item of orig.items) {
    await supabaseAdmin.rpc('increment_stock', { p_id: item.product_id, p_qty: item.qty })
  }

  await supabaseAdmin.from('ticket_counter').update({ val: newCount }).eq('id', 1)

  await addLog('rect', `Rectificativo ${ticketId}`,
    `Rectifica ${orig.ticket_id} · Motivo: ${reason} · Por: ${auth!.name}`, auth)

  return NextResponse.json({ data: saved })
}
