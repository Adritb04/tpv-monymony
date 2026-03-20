export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado', 'cajero'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id     = searchParams.get('id')
  const status = searchParams.get('status') || ''

  if (id) {
    const { data, error } = await supabaseAdmin
      .from('deposits')
      .select('*, events:deposit_events(*)')
      .eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  let query = supabaseAdmin
    .from('deposits').select('*')
    .order('ts', { ascending: false }).limit(100)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado', 'cajero'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const body = await req.json()
  const {
    deposit_type, client_name, client_dni, client_phone, client_address,
    description, appraised_value, agreed_price, commission_pct,
    entry_date, expiry_date, category_id, notes, emoji
  } = body

  if (!client_name || !client_dni || !description || !agreed_price)
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })

  // Counter
  const { data: counter } = await supabaseAdmin
    .from('ticket_counter').select('deposit_val').eq('id', 1).single()
  const newCount = (counter?.deposit_val || 1000) + 1
  const prefix = deposit_type === 'empeno' ? 'EMP' : 'DEP'
  const ref = `${prefix}-${String(newCount).padStart(6, '0')}`
  const ts = Date.now()
  const now = new Date()
  const entryDate = entry_date || now.toLocaleDateString('es-ES')

  // Create product automatically (price = agreed_price, inactive until sold)
  const { data: product } = await supabaseAdmin
    .from('products')
    .insert({
      name: description,
      emoji: emoji || (deposit_type === 'empeno' ? '🏷️' : '📦'),
      category_id,
      price: agreed_price,
      regime: 'iva', iva_rate: 21,
      cost_price: agreed_price * (1 - (commission_pct || 20) / 100),
      stock: 1, active: true,
    })
    .select().single()

  const { data: deposit, error } = await supabaseAdmin
    .from('deposits')
    .insert({
      ref, deposit_type: deposit_type || 'deposito',
      client_name, client_dni,
      client_phone: client_phone || '',
      client_address: client_address || '',
      description, appraised_value, agreed_price,
      commission_pct: commission_pct || 20,
      entry_date: entryDate, expiry_date,
      status: 'activo',
      category_id, product_id: product?.id || null,
      notes: notes || '',
      created_by: auth!.userId, created_by_name: auth!.name, ts
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create initial event
  await supabaseAdmin.from('deposit_events').insert({
    deposit_id: deposit.id,
    event_type: 'creacion',
    detail: `${deposit_type === 'empeno' ? 'Empeño' : 'Depósito'} registrado. Valor tasado: ${appraised_value}€`,
    created_by_name: auth!.name,
  })

  await supabaseAdmin.from('ticket_counter').update({ deposit_val: newCount }).eq('id', 1)
  await addLog('admin', `${deposit_type === 'empeno' ? 'Empeño' : 'Depósito'} ${ref}`,
    `${client_name} · ${description} · ${agreed_price}€`, auth)

  return NextResponse.json({ data: { deposit, product } })
}

export async function PUT(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado', 'cajero'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { id, status, event_detail, amount } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('deposits').update({ status }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log event
  const eventMap: Record<string, string> = {
    vendido: 'venta', recuperado: 'recuperacion',
    caducado: 'caducidad', cancelado: 'nota'
  }
  await supabaseAdmin.from('deposit_events').insert({
    deposit_id: id,
    event_type: eventMap[status] || 'nota',
    detail: event_detail || `Estado cambiado a ${status}`,
    amount: amount || null,
    created_by_name: auth!.name,
  })

  // If sold or recovered, deactivate product
  if (status === 'vendido' || status === 'recuperado' || status === 'cancelado') {
    if (data.product_id) {
      await supabaseAdmin.from('products').update({ active: false, stock: 0 }).eq('id', data.product_id)
    }
  }

  await addLog('admin', `Depósito/Empeño ${data.ref} → ${status}`, event_detail || '', auth)
  return NextResponse.json({ data })
}
