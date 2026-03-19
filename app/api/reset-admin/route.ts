export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  // 1. Get user from DB
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('username', 'admin')
    .eq('active', true)
    .single()

  if (error || !user) return NextResponse.json({ step: 'db', error: error?.message || 'no user' })

  // 2. Test bcrypt
  const valid = await bcrypt.compare('admin123', user.password_hash)

  // 3. Generate new hash for comparison
  const newHash = await bcrypt.hash('admin123', 10)

  return NextResponse.json({
    step: 'bcrypt',
    valid,
    stored_hash: user.password_hash.substring(0, 20) + '...',
    new_hash: newHash.substring(0, 20) + '...',
    user_found: !!user,
    active: user.active
  })
}