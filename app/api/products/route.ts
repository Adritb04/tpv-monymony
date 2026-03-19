export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const [{ data: products, error }, { data: categories }] = await Promise.all([
    supabaseAdmin.from('products').select('*').order('name'),
    supabaseAdmin.from('categories').select('id, name, icon'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const catMap = Object.fromEntries((categories || []).map((c: any) => [c.id, c]))
  const data = (products || []).map((p: any) => ({ ...p, category: catMap[p.category_id] || null }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({
      name: body.name,
      emoji: body.emoji || '📦',
      category_id: body.category_id,
      price: body.price,
      regime: body.regime || 'iva',
      iva_rate: body.iva_rate || 21,
      cost_price: body.cost_price || 0,
      stock: body.stock || 0,
      unit_type: body.unit_type || 'unidad',
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Producto creado', body.name, auth)
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body
  const { data, error } = await supabaseAdmin
    .from('products')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Producto editado', body.name || String(id), auth)
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Producto eliminado', String(id), auth)
  return NextResponse.json({ ok: true })
}
