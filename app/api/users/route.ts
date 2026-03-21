export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const isPublic = searchParams.get('public') === 'true'

  // Public endpoint for login screen — only returns minimal safe fields
  if (isPublic) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, name, role, active')
      .eq('active', true)
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, name, role, active, last_login, created_at')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { username, password, name, role } = await req.json()
  if (!username || !password || !name) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const hash = await bcrypt.hash(password, 12)
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ username: username.toLowerCase(), password_hash: hash, name, role: role || 'cajero', active: true })
    .select('id, username, name, role, active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Usuario creado', `${name} (${role})`, auth)
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { id, password, name, role, active } = await req.json()
  const updates: Record<string, unknown> = { name, role, active }
  if (password) updates.password_hash = await bcrypt.hash(password, 12)

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, username, name, role, active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Usuario editado', `${name} (${role})`, auth)
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  // Soft delete — never hard delete users for audit trail
  const { error } = await supabaseAdmin.from('users').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await addLog('admin', 'Usuario desactivado', String(id), auth)
  return NextResponse.json({ ok: true })
}
