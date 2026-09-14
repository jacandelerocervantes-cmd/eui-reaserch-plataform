import { describe, expect, it } from 'vitest'
import { cacheAvailable, cacheGet, cacheSet, sha256Hex } from './cache'

describe('server/cache', () => {
  it('sha256Hex es determinista y produce hex de 64 caracteres', async () => {
    const a = await sha256Hex('token-de-sesion-ejemplo')
    const b = await sha256Hex('token-de-sesion-ejemplo')
    const c = await sha256Hex('token-distinto')

    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('sin credenciales de Upstash, degrada a no-cache sin lanzar errores', async () => {
    // En este entorno de test no hay UPSTASH_REDIS_REST_URL/TOKEN configurados.
    expect(cacheAvailable).toBe(false)

    await expect(cacheSet('k', { hola: 'mundo' }, 60)).resolves.toBeUndefined()
    await expect(cacheGet('k')).resolves.toBeNull()
  })
})
