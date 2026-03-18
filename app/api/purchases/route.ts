export const dynamic = 'force-dynamic'

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
      .from('purchases')
      .select('*, items:purchase_items(*)')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  const { data, error } = await supabaseAdmin
    .from('purchases')
    .select('*, items:purchase_items(id, name, qty, unit_cost, sale_price)')
    .order('ts', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const body = await req.json()
  const { supplier_name, supplier_nif, supplier_invoice, invoice_date, invoice_total, notes, items } = body

  if (!supplier_name || !supplier_nif || !supplier_invoice || !items?.length)
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })

  // Get counter
  const { data: counter } = await supabaseAdmin
    .from('ticket_counter').select('purchase_val').eq('id', 1).single()
  const newCount = (counter?.purchase_val || 1000) + 1
  const ref = `COM-${String(newCount).padStart(6, '0')}`
  const ts = Date.now()
  const now = new Date()

  // Create purchase record
  const { data: purchase, error: pErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      ref, supplier_name, supplier_nif, supplier_invoice,
      invoice_date, invoice_total, notes: notes || '',
      created_by: auth!.userId, created_by_name: auth!.name, ts
    })
    .select().single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // Create products and purchase_items
  const createdProducts = []
  for (const item of items) {
    // Create product
    const { data: product } = await supabaseAdmin
      .from('products')
      .insert({
        name: item.name, emoji: item.emoji || '📦',
        category_id: item.category_id,
        price: item.sale_price, regime: 'iva',
        iva_rate: item.iva_rate || 21,
        cost_price: item.unit_cost,
        stock: item.qty, active: true,
      })
      .select().single()

    if (product) {
      createdProducts.push(product)
      // Create purchase_item linking purchase ↔ product
      await supabaseAdmin.from('purchase_items').insert({
        purchase_id: purchase.id,
        product_id: product.id,
        name: item.name, emoji: item.emoji || '📦',
        category_id: item.category_id,
        qty: item.qty, unit_cost: item.unit_cost,
        sale_price: item.sale_price, iva_rate: item.iva_rate || 21,
      })
    }
  }

  // Update counter
  await supabaseAdmin.from('ticket_counter').update({ purchase_val: newCount }).eq('id', 1)

  await addLog('admin', `Compra factura ${ref}`,
    `${supplier_name} · ${items.length} artículo(s) · ${invoice_total}€`, auth)

  return NextResponse.json({ data: { purchase, products: createdProducts } })
}
