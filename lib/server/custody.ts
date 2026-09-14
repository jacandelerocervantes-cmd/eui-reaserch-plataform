// Cadena de custodia (hash chain SHA-256) + Merkle tree — espejo en
// TypeScript de la lógica que corre en la base de datos
// (supabase/pendiente/012_custody_events.sql: canonical_json,
// append_custody_event, verify_custody_chain) y del diseño original en
// auditoria/custody_audit.py.
//
// Por qué existe este espejo: la cadena real vive en Postgres (se computa y
// se inserta atómicamente ahí, con un advisory lock, para no tener una
// condición de carrera entre un SELECT del último hash y el INSERT
// siguiente desde dos requests concurrentes). Este archivo permite (a)
// probar el algoritmo con un test que SÍ corre hoy sin necesitar la
// migración ejecutada en un proyecto real de Supabase, y (b) reutilizar la
// misma lógica desde código de servidor (Next.js) para verificación o
// tooling de auditoría sin tener que ir a la base por cada paso.
//
// canonicalJson() reproduce la misma forma canónica que la función SQL
// public.canonical_json(): objeto con claves ordenadas alfabéticamente,
// arrays en su orden original, sin espacios — JSON.stringify no garantiza
// orden de claves entre implementaciones, por eso no se usa directo aquí.

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']'
  }
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const entries = keys.map(
    (key) => JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])
  )
  return '{' + entries.join(',') + '}'
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const GENESIS_HASH = '0'.repeat(64)

// Clave de tiempo determinista para el mensaje que se hashea. No es
// necesario que coincida byte a byte con el formato que usa la función SQL
// (to_char con microsegundos) — cada lado (Postgres / este módulo) solo
// necesita ser consistente CONSIGO MISMO entre el momento de calcular el
// hash y el momento de verificarlo; no se comparan hashes entre ambos
// lados. `Date` en JS solo tiene precisión de milisegundos, así que se usa
// tal cual (ISO 8601 completo) en vez de fingir microsegundos inexistentes.
export function createdAtKey(createdAt: Date): string {
  return createdAt.toISOString()
}

export interface CustodyEventInput {
  payload: unknown
  createdAt: Date
}

export interface CustodyEvent extends CustodyEventInput {
  prevHash: string
  eventHash: string
}

export async function computeCustodyEventHash(
  prevHash: string,
  payload: unknown,
  createdAt: Date
): Promise<string> {
  const message = `${prevHash}|${canonicalJson(payload)}|${createdAtKey(createdAt)}`
  return sha256Hex(message)
}

// Construye una cadena en memoria a partir de una lista de eventos en
// orden — equivalente a lo que hace append_custody_event() una fila a la
// vez en la base de datos.
export async function buildCustodyChain(events: CustodyEventInput[]): Promise<CustodyEvent[]> {
  const chain: CustodyEvent[] = []
  let prevHash = GENESIS_HASH
  for (const event of events) {
    const eventHash = await computeCustodyEventHash(prevHash, event.payload, event.createdAt)
    chain.push({ ...event, prevHash, eventHash })
    prevHash = eventHash
  }
  return chain
}

export interface ChainVerification {
  isValid: boolean
  brokenIndex: number | null
  reason: string | null
}

// Equivalente a public.verify_custody_chain(): recalcula cada hash de la
// cadena y compara contra lo almacenado, además de encadenar prevHash.
export async function verifyCustodyChain(chain: CustodyEvent[]): Promise<ChainVerification> {
  let expectedPrev = GENESIS_HASH
  for (let i = 0; i < chain.length; i++) {
    const event = chain[i]
    if (event.prevHash !== expectedPrev) {
      return { isValid: false, brokenIndex: i, reason: 'prev_hash no coincide con el evento anterior' }
    }
    const recomputed = await computeCustodyEventHash(event.prevHash, event.payload, event.createdAt)
    if (recomputed !== event.eventHash) {
      return { isValid: false, brokenIndex: i, reason: 'event_hash recalculado no coincide (posible alteración)' }
    }
    expectedPrev = event.eventHash
  }
  return { isValid: true, brokenIndex: null, reason: null }
}

// ── Merkle tree ─────────────────────────────────────────────────────────
// NO está enganchado a ningún flujo de escritura de la app — se implementa
// y se prueba aquí porque CORRE 4 lo pide explícitamente ("si la cadena
// actual es insuficiente, implementa un Árbol de Merkle con test de
// inclusión real"), pero auditoria/custody_audit.py ya documenta por qué no
// conviene desplegarlo todavía (volumen bajo, sin caso de uso de
// verificación parcial tipo light-client). Queda listo y probado para el
// día en que se agregue un requisito de anclaje externo (publicar solo la
// raíz periódicamente).

export interface MerkleProofStep {
  sibling: string
  side: 'L' | 'R'
}

async function hashPair(left: string, right: string): Promise<string> {
  return sha256Hex(left + right)
}

export async function buildMerkleLevels(leafHashes: string[]): Promise<string[][]> {
  if (leafHashes.length === 0) throw new Error('buildMerkleLevels requiere al menos una hoja')
  const levels: string[][] = [leafHashes]
  let current = leafHashes
  while (current.length > 1) {
    const next: string[] = []
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i]
      const right = i + 1 < current.length ? current[i + 1] : left
      next.push(await hashPair(left, right))
    }
    levels.push(next)
    current = next
  }
  return levels
}

export async function merkleRoot(leafHashes: string[]): Promise<string> {
  const levels = await buildMerkleLevels(leafHashes)
  return levels[levels.length - 1][0]
}

export function merkleProof(levels: string[][], leafIndex: number): MerkleProofStep[] {
  const path: MerkleProofStep[] = []
  let idx = leafIndex
  for (const level of levels.slice(0, -1)) {
    const isRight = idx % 2 === 1
    const siblingIdx = isRight ? idx - 1 : idx + 1
    const sibling = siblingIdx < level.length ? level[siblingIdx] : level[idx]
    path.push({ sibling, side: isRight ? 'L' : 'R' })
    idx = Math.floor(idx / 2)
  }
  return path
}

export async function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProofStep[],
  root: string
): Promise<boolean> {
  let current = leafHash
  for (const step of proof) {
    current = step.side === 'L' ? await hashPair(step.sibling, current) : await hashPair(current, step.sibling)
  }
  return current === root
}
