export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const hash = await bcrypt.hash('admin123', 10)
  await supabaseAdmin
    .from('users')
    .update({ password_hash: hash })
    .eq('username', 'admin')
  return NextResponse.json({ ok: true, hash })
}
