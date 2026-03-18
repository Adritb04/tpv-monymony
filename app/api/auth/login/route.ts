export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password)
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 400 })

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .eq('active', true)
      .single()

    if (error || !user)
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })

    // Update last_login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)

    const payload = { userId: user.id, username: user.username, role: user.role, name: user.name }
    const token = signToken(payload)

    await addLog('auth', 'Inicio de sesión', `${user.name} (${user.role})`, payload)

    return NextResponse.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } })
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
