export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthFromRequest } from '@/lib/auth'
import { addLog } from '@/lib/log'

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const limit  = parseInt(searchParams.get('limit') || '20')

  let query = supabaseAdmin
    .from('cash_register')
    .select('*')
    .order('ts', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { action } = body

  // ── APERTURA ──
  if (action === 'apertura') {
    const { fondo_inicial, notes } = body

    // Check if there's already an open cash register
    const { data: open } = await supabaseAdmin
      .from('cash_register')
      .select('id')
      .eq('status', 'abierto')
      .limit(1)
      .single()

    if (open) return NextResponse.json({ error: 'Ya hay una caja abierta. Ciérrala antes de abrir una nueva.' }, { status: 400 })

    const now = new Date()
    const { data, error } = await supabaseAdmin
      .from('cash_register')
      .insert({
        type: 'apertura',
        fondo_inicial: fondo_inicial || 0,
        notes: notes || '',
        opened_at: now.toISOString(),
        opened_by_id: auth.userId,
        opened_by_name: auth.name,
        status: 'abierto',
        ts: now.getTime(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await addLog('admin', 'Apertura de caja', `Fondo: ${fondo_inicial}€ · ${auth.name}`, auth)
    return NextResponse.json({ data })
  }

  // ── CIERRE ──
  if (action === 'cierre') {
    const { apertura_id, real_contado, notes } = body

    // Get apertura
    const { data: apertura, error: aErr } = await supabaseAdmin
      .from('cash_register')
      .select('*')
      .eq('id', apertura_id)
      .eq('status', 'abierto')
      .single()

    if (aErr || !apertura) return NextResponse.json({ error: 'Caja no encontrada o ya cerrada' }, { status: 404 })

    const now = new Date()

    // Calculate sales since opening
    const { data: salesData } = await supabaseAdmin
      .from('sales')
      .select('total, pay, type')
      .gte('ts', apertura.ts)
      .lte('ts', now.getTime())

    const ventas = salesData || []
    const ventas_efectivo = ventas
      .filter(s => s.pay === 'efectivo')
      .reduce((a, s) => a + parseFloat(s.total), 0)
    const ventas_tarjeta = ventas
      .filter(s => s.pay === 'tarjeta')
      .reduce((a, s) => a + parseFloat(s.total), 0)
    const ventas_total = ventas_efectivo + ventas_tarjeta

    // Expected = fondo + cash sales
    const esperado = parseFloat(apertura.fondo_inicial) + ventas_efectivo
    const diferencia = parseFloat(real_contado) - esperado

    const { data, error } = await supabaseAdmin
      .from('cash_register')
      .update({
        type: 'cierre',
        ventas_efectivo,
        ventas_tarjeta,
        ventas_total,
        esperado,
        real_contado: parseFloat(real_contado),
        diferencia,
        closed_at: now.toISOString(),
        closed_by_id: auth.userId,
        closed_by_name: auth.name,
        notes: notes || '',
        status: 'cerrado',
      })
      .eq('id', apertura_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await addLog('admin', 'Cierre de caja',
      `Efectivo: ${ventas_efectivo.toFixed(2)}€ · Esperado: ${esperado.toFixed(2)}€ · Real: ${real_contado}€ · Dif: ${diferencia.toFixed(2)}€ · ${auth.name}`, auth)

    return NextResponse.json({ data })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}