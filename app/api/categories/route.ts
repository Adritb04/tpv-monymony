import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('categories').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })
  const body = await req.json()
  const { data, error } = await supabaseAdmin.from('categories').insert({ name: body.name, icon: body.icon || '🏷️' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Categoría creada', body.name, auth)
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })
  const { id, name, icon } = await req.json()
  const { data, error } = await supabaseAdmin.from('categories').update({ name, icon }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Categoría editada', name, auth)
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Categoría eliminada', String(id), auth)
  return NextResponse.json({ ok: true })
}
