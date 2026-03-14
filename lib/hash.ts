import crypto from 'crypto'

/**
 * Compute SHA-256 hash chaining each ticket to the previous one.
 * Chain content: prevHash | ticketId | nif | total (6 decimals) | timestamp
 * This implements the inalterability principle of Ley 11/2021 / Reglamento Verifactu.
 */
export function computeHash(
  prevHash: string,
  ticketId: string,
  nif: string,
  total: number,
  ts: number
): string {
  const chain = `${prevHash}|${ticketId}|${nif}|${total.toFixed(6)}|${ts}`
  return crypto.createHash('sha256').update(chain, 'utf8').digest('hex')
}

export const GENESIS_HASH = '0'.repeat(64)

/**
 * Verify the full chain of sales ordered by timestamp ascending.
 * Returns list of ticket_ids with broken hashes.
 */
export function verifyChain(
  sales: Array<{ ticket_id: string; nif: string; total: number; ts: number; hash: string; prev_hash: string }>
): string[] {
  const broken: string[] = []
  const ordered = [...sales].sort((a, b) => a.ts - b.ts)
  let prev = GENESIS_HASH

  for (const s of ordered) {
    const expected = computeHash(prev, s.ticket_id, s.nif, s.total, s.ts)
    if (s.hash !== expected) broken.push(s.ticket_id)
    prev = s.hash
  }
  return broken
}
