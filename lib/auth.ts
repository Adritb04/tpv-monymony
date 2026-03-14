import jwt from 'jsonwebtoken'
import { AuthPayload } from '@/types'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET!

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return null
  }
}

export function getAuthFromRequest(req: NextRequest): AuthPayload | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}

export function requireRole(
  auth: AuthPayload | null,
  roles: string[]
): { ok: boolean; error?: string } {
  if (!auth) return { ok: false, error: 'No autenticado' }
  if (!roles.includes(auth.role)) return { ok: false, error: 'Sin permisos' }
  return { ok: true }
}
