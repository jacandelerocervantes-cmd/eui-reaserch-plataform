import { describe, expect, it } from 'vitest'
import { hmacHex, isValidQrSignature, timingSafeEqualHex } from './hmac'

describe('_shared/hmac — firma de asistencia por QR (register-attendance)', () => {
  const secret = 'secreto-de-prueba-32-bytes-min-xx'
  const hash = 'qr-hash-sesion-123'

  it('hmacHex es determinista y sensible al mensaje/secreto', async () => {
    const a = await hmacHex(secret, hash)
    const b = await hmacHex(secret, hash)
    const c = await hmacHex(secret, 'otro-hash')
    const d = await hmacHex('otro-secreto', hash)

    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('timingSafeEqualHex rechaza longitudes distintas sin lanzar', () => {
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false)
    expect(timingSafeEqualHex('', '')).toBe(true)
  })

  it('isValidQrSignature ACEPTA una firma generada con el secreto correcto (camino feliz real)', async () => {
    const sig = await hmacHex(secret, hash)
    await expect(isValidQrSignature(secret, hash, sig)).resolves.toBe(true)
  })

  it('isValidQrSignature RECHAZA una firma forjada (secreto incorrecto)', async () => {
    const sigForjada = await hmacHex('secreto-equivocado', hash)
    await expect(isValidQrSignature(secret, hash, sigForjada)).resolves.toBe(false)
  })

  it('isValidQrSignature RECHAZA una firma válida pero para OTRO hash (replay con hash distinto)', async () => {
    const sigDeOtroHash = await hmacHex(secret, 'otro-hash-distinto')
    await expect(isValidQrSignature(secret, hash, sigDeOtroHash)).resolves.toBe(false)
  })

  it('isValidQrSignature RECHAZA una firma manipulada un solo carácter (detección de alteración)', async () => {
    const sig = await hmacHex(secret, hash)
    const sigManipulada = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1)
    await expect(isValidQrSignature(secret, hash, sigManipulada)).resolves.toBe(false)
  })

  it('isValidQrSignature RECHAZA si falta la firma o el secreto del servidor no está configurado', async () => {
    const sig = await hmacHex(secret, hash)
    await expect(isValidQrSignature(secret, hash, '')).resolves.toBe(false)
    await expect(isValidQrSignature('', hash, sig)).resolves.toBe(false)
  })
})
