import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '200')

  const { data, error } = await supabaseAdmin
    .from('op_log')
    .select('*')
    .order('ts', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
