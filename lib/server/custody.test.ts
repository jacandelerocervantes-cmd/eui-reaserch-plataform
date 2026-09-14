import { describe, expect, it } from 'vitest'
import {
  GENESIS_HASH,
  buildCustodyChain,
  buildMerkleLevels,
  canonicalJson,
  computeCustodyEventHash,
  merkleProof,
  merkleRoot,
  verifyCustodyChain,
  verifyMerkleProof,
} from './custody'

describe('lib/server/custody — canonicalJson (determinismo de orden de claves)', () => {
  it('produce el mismo string sin importar el orden de inserción de las claves', () => {
    const a = canonicalJson({ b: 2, a: 1, c: { z: 9, y: 8 } })
    const b = canonicalJson({ a: 1, c: { y: 8, z: 9 }, b: 2 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":1,"b":2,"c":{"y":8,"z":9}}')
  })

  it('preserva el orden de los arrays (no los reordena)', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]')
  })
})

describe('lib/server/custody — cadena de hashes (hash chain SHA-256 real)', () => {
  it('una cadena de 3 eventos reales (submissions -> evaluations -> grades) se construye y verifica válida', async () => {
    const chain = await buildCustodyChain([
      { payload: { file_url: 'a.pdf' }, createdAt: new Date('2026-08-23T10:00:00.000Z') },
      { payload: { score: 9.5 }, createdAt: new Date('2026-08-23T10:05:00.000Z') },
      { payload: { score: 9.5, final: true }, createdAt: new Date('2026-08-23T10:10:00.000Z') },
    ])

    expect(chain[0].prevHash).toBe(GENESIS_HASH)
    expect(chain[1].prevHash).toBe(chain[0].eventHash)
    expect(chain[2].prevHash).toBe(chain[1].eventHash)
    chain.forEach((e) => expect(e.eventHash).toMatch(/^[0-9a-f]{64}$/))

    const verification = await verifyCustodyChain(chain)
    expect(verification).toEqual({ isValid: true, brokenIndex: null, reason: null })
  })

  it('computeCustodyEventHash es determinista: mismo payload + mismo prevHash + mismo instante = mismo hash', async () => {
    const createdAt = new Date('2026-08-23T10:00:00.000Z')
    const h1 = await computeCustodyEventHash(GENESIS_HASH, { score: 10 }, createdAt)
    const h2 = await computeCustodyEventHash(GENESIS_HASH, { score: 10 }, createdAt)
    expect(h1).toBe(h2)
  })

  it('DETECTA la alteración de un payload después de creado el evento (integridad real)', async () => {
    const chain = await buildCustodyChain([
      { payload: { score: 9.5 }, createdAt: new Date('2026-08-23T10:00:00.000Z') },
      { payload: { score: 8.0 }, createdAt: new Date('2026-08-23T10:05:00.000Z') },
    ])

    // Simula que alguien reescribió el payload de la fila 1 directo en la
    // tabla (sin pasar por append_custody_event) — el event_hash guardado
    // ya no corresponde al contenido actual.
    const tampered = [...chain]
    tampered[1] = { ...tampered[1], payload: { score: 10.0 } }

    const verification = await verifyCustodyChain(tampered)
    expect(verification.isValid).toBe(false)
    expect(verification.brokenIndex).toBe(1)
    expect(verification.reason).toMatch(/no coincide/i)
  })

  it('DETECTA una cadena reordenada/con eslabón faltante (prev_hash roto)', async () => {
    const chain = await buildCustodyChain([
      { payload: { a: 1 }, createdAt: new Date('2026-08-23T10:00:00.000Z') },
      { payload: { b: 2 }, createdAt: new Date('2026-08-23T10:05:00.000Z') },
      { payload: { c: 3 }, createdAt: new Date('2026-08-23T10:10:00.000Z') },
    ])

    const withGap = [chain[0], chain[2]] // se quita el eslabón del medio
    const verification = await verifyCustodyChain(withGap)
    expect(verification.isValid).toBe(false)
    expect(verification.brokenIndex).toBe(1)
    expect(verification.reason).toMatch(/prev_hash/i)
  })
})

describe('lib/server/custody — Merkle tree (no desplegado en producción, ver custody_audit.py; probado por completitud del módulo)', () => {
  it('calcula una raíz Merkle real sobre 5 hojas (número impar, ejercita la duplicación del último nodo)', async () => {
    const leaves = ['e1', 'e2', 'e3', 'e4', 'e5']
    const levels = await buildMerkleLevels(leaves)
    const root = await merkleRoot(leaves)

    expect(levels[0]).toEqual(leaves)
    expect(root).toMatch(/^[0-9a-f]{64}$/)
    expect(root).toBe(levels[levels.length - 1][0])
  })

  it('genera y verifica una prueba de inclusión (Merkle proof) real para una hoja intermedia', async () => {
    const leaves = ['hash-evento-0', 'hash-evento-1', 'hash-evento-2', 'hash-evento-3', 'hash-evento-4', 'hash-evento-5']
    const levels = await buildMerkleLevels(leaves)
    const root = levels[levels.length - 1][0]

    const leafIndex = 3
    const proof = merkleProof(levels, leafIndex)
    const isValid = await verifyMerkleProof(leaves[leafIndex], proof, root)

    expect(isValid).toBe(true)
  })

  it('RECHAZA una prueba de inclusión para una hoja que no está en el árbol (dato falsificado)', async () => {
    const leaves = ['hash-evento-0', 'hash-evento-1', 'hash-evento-2', 'hash-evento-3']
    const levels = await buildMerkleLevels(leaves)
    const root = levels[levels.length - 1][0]

    const proof = merkleProof(levels, 2) // prueba real de la hoja 2...
    const isValid = await verifyMerkleProof('hash-evento-FALSIFICADO', proof, root) // ...pero para otra hoja

    expect(isValid).toBe(false)
  })
})
