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
  const id     = searchParams.get('id')

  // Get single register with movements
  if (id) {
    const [{ data: reg }, { data: movs }] = await Promise.all([
      supabaseAdmin.from('cash_register').select('*').eq('id', id).single(),
      supabaseAdmin.from('cash_movements').select('*').eq('register_id', id).order('ts'),
    ])
    return NextResponse.json({ data: reg, movements: movs || [] })
  }

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

  // ── APERTURA ──────────────────────────────────────────────────
  if (action === 'apertura') {
    const { fondo_inicial, notes } = body

    const { data: open } = await supabaseAdmin
      .from('cash_register').select('id').eq('status', 'abierto').limit(1).single()
    if (open) return NextResponse.json({ error: 'Ya hay una caja abierta. Ciérrala antes.' }, { status: 400 })

    const now = new Date()
    const { data, error } = await supabaseAdmin
      .from('cash_register')
      .insert({
        fondo_inicial: fondo_inicial || 0,
        notes: notes || '',
        opened_at: now.toISOString(),
        opened_by_id: auth.userId,
        opened_by_name: auth.name,
        status: 'abierto',
        ts: now.getTime(),
      })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await addLog('admin', 'Apertura de caja', `Fondo: ${fondo_inicial}€ · ${auth.name}`, auth)
    return NextResponse.json({ data })
  }

  // ── MOVIMIENTO (entrada/salida/gasto/adelanto) ────────────────
  if (action === 'movimiento') {
    const { register_id, type, amount, concept, notes } = body
    if (!register_id || !type || !amount || !concept)
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

    const now = new Date()
    const { data, error } = await supabaseAdmin
      .from('cash_movements')
      .insert({
        register_id, type, amount: Math.abs(parseFloat(amount)),
        concept, notes: notes || '',
        created_by_id: auth.userId,
        created_by_name: auth.name,
        ts: now.getTime(),
      })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const label = { entrada:'Entrada', salida:'Salida', gasto:'Gasto', adelanto:'Adelanto' }[type] || type
    await addLog('admin', `${label} de caja`, `${amount}€ — ${concept} · ${auth.name}`, auth)
    return NextResponse.json({ data })
  }

  // ── CIERRE ────────────────────────────────────────────────────
  if (action === 'cierre') {
    const { register_id, real_contado, conteo_detalle, notes } = body

    const { data: reg, error: rErr } = await supabaseAdmin
      .from('cash_register').select('*').eq('id', register_id).eq('status', 'abierto').single()
    if (rErr || !reg) return NextResponse.json({ error: 'Caja no encontrada o ya cerrada' }, { status: 404 })

    const now = new Date()

    // Sales since opening
    const { data: salesData } = await supabaseAdmin
      .from('sales').select('total, pay, type')
      .gte('ts', reg.ts).lte('ts', now.getTime())

    const ventas_efectivo = (salesData || [])
      .filter(s => s.pay === 'efectivo')
      .reduce((a, s) => a + parseFloat(s.total), 0)
    const ventas_tarjeta = (salesData || [])
      .filter(s => s.pay === 'tarjeta')
      .reduce((a, s) => a + parseFloat(s.total), 0)

    // Movements since opening
    const { data: movsData } = await supabaseAdmin
      .from('cash_movements').select('type, amount').eq('register_id', register_id)

    const entradas_manuales = (movsData || [])
      .filter(m => m.type === 'entrada')
      .reduce((a, m) => a + parseFloat(m.amount), 0)
    const salidas_manuales = (movsData || [])
      .filter(m => ['salida','gasto','adelanto'].includes(m.type))
      .reduce((a, m) => a + parseFloat(m.amount), 0)

    // REBU purchases paid in cash during this shift
    const { data: rebuData } = await supabaseAdmin
      .from('rebu_purchases').select('buy_price')
      .gte('ts', reg.ts).lte('ts', now.getTime())
    const rebu_pagado = (rebuData || []).reduce((a, r) => a + parseFloat(r.buy_price), 0)

    // Expected = fondo + ventas_efectivo + entradas - salidas - rebu_pagado
    const esperado = parseFloat(reg.fondo_inicial) + ventas_efectivo + entradas_manuales - salidas_manuales - rebu_pagado
    const real     = parseFloat(real_contado)
    const diferencia = real - esperado

    const { data, error } = await supabaseAdmin
      .from('cash_register')
      .update({
        status: 'cerrado',
        closed_at: now.toISOString(),
        closed_by_id: auth.userId,
        closed_by_name: auth.name,
        conteo_detalle: conteo_detalle || {},
        real_contado: real,
        ventas_efectivo,
        ventas_tarjeta,
        ventas_total: ventas_efectivo + ventas_tarjeta,
        entradas_manuales,
        salidas_manuales,
        rebu_pagado,
        esperado,
        diferencia,
        notes: notes || '',
      })
      .eq('id', register_id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await addLog('admin', 'Cierre de caja',
      `Esperado: ${esperado.toFixed(2)}€ · Real: ${real.toFixed(2)}€ · Dif: ${diferencia.toFixed(2)}€ · REBU: -${rebu_pagado.toFixed(2)}€ · ${auth.name}`, auth)

    // Return with movements for PDF
    const { data: movsFinal } = await supabaseAdmin
      .from('cash_movements').select('*').eq('register_id', register_id).order('ts')

    return NextResponse.json({ data, movements: movsFinal || [] })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
