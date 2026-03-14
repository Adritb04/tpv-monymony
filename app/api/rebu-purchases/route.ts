import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const { data, error } = await supabaseAdmin
      .from('rebu_purchases').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  const { data, error } = await supabaseAdmin
    .from('rebu_purchases').select('*')
    .order('ts', { ascending: false }).limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const body = await req.json()
  const {
    seller_name, seller_dni, seller_address, seller_phone,
    description, buy_price, sale_price, category_id, notes,
    emoji
  } = body

  if (!seller_name || !seller_dni || !description || !buy_price)
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })

  // Counter
  const { data: counter } = await supabaseAdmin
    .from('ticket_counter').select('rebu_val').eq('id', 1).single()
  const newCount = (counter?.rebu_val || 1000) + 1
  const ref = `REBU-${String(newCount).padStart(6, '0')}`
  const ts = Date.now()

  // Create product automatically
  const { data: product } = await supabaseAdmin
    .from('products')
    .insert({
      name: description, emoji: emoji || '♻️',
      category_id, price: sale_price,
      regime: 'rebu', iva_rate: 21,
      cost_price: buy_price, stock: 1, active: true,
    })
    .select().single()

  // Create rebu_purchase record
  const { data: purchase, error } = await supabaseAdmin
    .from('rebu_purchases')
    .insert({
      ref, seller_name, seller_dni,
      seller_address: seller_address || '',
      seller_phone: seller_phone || '',
      description, buy_price, sale_price,
      category_id, product_id: product?.id || null,
      notes: notes || '',
      created_by: auth!.userId, created_by_name: auth!.name, ts
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('ticket_counter').update({ rebu_val: newCount }).eq('id', 1)
  await addLog('admin', `Compra REBU ${ref}`, `${seller_name} · ${description} · ${buy_price}€`, auth)

  return NextResponse.json({ data: { purchase, product } })
}
