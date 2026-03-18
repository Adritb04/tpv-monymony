export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest, requireRole } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  const perm = requireRole(auth, ['admin', 'encargado'])
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'csv'
  const from   = searchParams.get('from') || ''
  const to     = searchParams.get('to')   || ''

  let query = supabaseAdmin
    .from('sales')
    .select('*')
    .order('ts', { ascending: true })

  if (from) query = query.gte('ts', parseInt(from))
  if (to)   query = query.lte('ts', parseInt(to))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await addLog('admin', `Exportación ${format.toUpperCase()}`, `${data?.length} registros`, auth)

  if (format === 'json') {
    const json = JSON.stringify({ exportDate: new Date().toISOString(), records: data?.length, sales: data }, null, 2)
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="TPV_backup_${new Date().toISOString().slice(0,10)}.json"`,
      },
    })
  }

  // CSV
  const headers = ['ticket_id','type','date','time','cashier_name','pay','base','iva_total','total','rect_of','hash']
  const rows = (data || []).map(s => headers.map(h => {
    const v = (s as Record<string, unknown>)[h]
    return `"${String(v ?? '').replace(/"/g, '""')}"`
  }).join(','))
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="TPV_ventas_${new Date().toISOString().slice(0,10)}.csv"`,
    },
  })
}
