export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  let query = supabaseAdmin.from('clients').select('*').order('name')
  if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,dni.ilike.%${q}%`)
  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { name, phone, dni, cp, notes } = body
  if (!name) return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('clients').insert({ name, phone, dni, cp, notes }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { id, ...fields } = body
  const { data, error } = await supabaseAdmin.from('clients').update(fields).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabaseAdmin.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
