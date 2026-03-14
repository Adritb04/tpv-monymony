import { supabaseAdmin } from './supabase'
import { AuthPayload } from '@/types'

export type LogType = 'venta' | 'rect' | 'auth' | 'admin' | 'system'

export async function addLog(
  type: LogType,
  action: string,
  detail: string,
  auth?: AuthPayload | null
) {
  const now = new Date()
  const dt = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES')
  await supabaseAdmin.from('op_log').insert({
    ts: now.getTime(),
    dt,
    type,
    action,
    detail,
    user_id: auth?.userId ?? null,
    username: auth?.username ?? 'sistema',
  })
}
