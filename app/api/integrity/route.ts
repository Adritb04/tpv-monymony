import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { verifyChain } from '@/lib/hash'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('sales')
    .select('ticket_id, nif, total, ts, hash, prev_hash')
    .order('ts', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const broken = verifyChain(data || [])
  const result = {
    total: data?.length || 0,
    broken: broken.length,
    broken_tickets: broken,
    ok: broken.length === 0,
  }

  await addLog('system', 'Verificación de integridad',
    `${result.total} tickets, ${result.broken} anomalías`, auth)

  return NextResponse.json({ data: result })
}
