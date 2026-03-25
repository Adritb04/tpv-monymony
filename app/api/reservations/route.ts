export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'activa'
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('*, clients(name, phone, dni)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { client_id, product_id, product_name, product_emoji, qty, price, abono, plazo_dias, notes } = body
    if (!client_id || !product_id) return NextResponse.json({ error: 'Cliente y producto obligatorios' }, { status: 400 })
    const plazo_fecha = new Date(Date.now() + (plazo_dias || 15) * 86400000).toISOString().split('T')[0]
    // Reserve stock
    const { data: prod } = await supabaseAdmin.from('products').select('stock, stock_reserved').eq('id', product_id).single()
    if (!prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    if ((prod.stock - (prod.stock_reserved || 0)) < qty) return NextResponse.json({ error: 'Stock insuficiente para reservar' }, { status: 400 })
    await supabaseAdmin.from('products').update({ stock_reserved: (prod.stock_reserved || 0) + qty }).eq('id', product_id)
    const { data, error } = await supabaseAdmin.from('reservations').insert({
      client_id, product_id, product_name, product_emoji, qty, price, abono: abono || 0,
      plazo_dias, plazo_fecha, notes, status: 'activa', created_by: auth.userId
    }).select('*, clients(name, phone, dni)').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  if (action === 'abono') {
    const { id, importe } = body
    const { data: res } = await supabaseAdmin.from('reservations').select('abono').eq('id', id).single()
    if (!res) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    const { data, error } = await supabaseAdmin.from('reservations').update({ abono: (res.abono || 0) + importe }).eq('id', id).select('*, clients(name, phone, dni)').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  if (action === 'cobrar') {
    const { id } = body
    const { data: res } = await supabaseAdmin.from('reservations').select('*, clients(name, phone, dni)').eq('id', id).single()
    if (!res) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    // Free reserved stock and reduce total stock
    await supabaseAdmin.from('products').update({
      stock_reserved: Math.max(0, (await supabaseAdmin.from('products').select('stock_reserved').eq('id', res.product_id).single()).data?.stock_reserved - res.qty),
      stock: Math.max(0, (await supabaseAdmin.from('products').select('stock').eq('id', res.product_id).single()).data?.stock - res.qty)
    }).eq('id', res.product_id)
    const { data, error } = await supabaseAdmin.from('reservations').update({ status: 'cobrada', cobrada_at: new Date().toISOString() }).eq('id', id).select('*, clients(name, phone, dni)').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  if (action === 'cancelar') {
    const { id } = body
    const { data: res } = await supabaseAdmin.from('reservations').select('*').eq('id', id).single()
    if (!res) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    // Free reserved stock
    const { data: prod } = await supabaseAdmin.from('products').select('stock_reserved').eq('id', res.product_id).single()
    await supabaseAdmin.from('products').update({ stock_reserved: Math.max(0, (prod?.stock_reserved || 0) - res.qty) }).eq('id', res.product_id)
    const { data, error } = await supabaseAdmin.from('reservations').update({ status: 'cancelada' }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
