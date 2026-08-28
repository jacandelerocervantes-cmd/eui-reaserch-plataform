import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `gemini.ts` guarda el estado del circuit breaker (consecutiveFailures,
 * circuitOpenUntil) en variables de módulo — para que cada test empiece de
 * un circuito CERRADO, se usa `vi.resetModules()` + import dinámico en cada
 * test, en vez de un solo `import` estático al tope del archivo.
 */

type GeminiModule = typeof import('./gemini')

function setDenoEnv(overrides: Record<string, string | undefined>) {
  const denoGlobal = (globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno
  denoGlobal.env.get = (key: string) => overrides[key]
}

async function freshGeminiModule(envOverrides: Record<string, string | undefined> = {}): Promise<GeminiModule> {
  vi.resetModules()
  setDenoEnv(envOverrides)
  return await import('./gemini')
}

describe('fetchGeminiWithRetry — circuit breaker, backoff exponencial y fallback a SLM local', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
    setDenoEnv({})
  })

  it('reintenta con backoff exponencial (1s, luego 2s) ante 503 y devuelve la respuesta cuando el 3er intento sí responde 200', async () => {
    const { fetchGeminiWithRetry } = await freshGeminiModule()
    let callCount = 0
    global.fetch = vi.fn(async () => {
      callCount++
      if (callCount < 3) return new Response('sobrecargado', { status: 503 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 })
    }) as unknown as typeof fetch

    const promise = fetchGeminiWithRetry('https://fake-gemini.test/generate', { hola: 'mundo' }, new AbortController().signal)
    // BASE_DELAY_MS=1000, backoff = 1000*2^attempt: intento0->falla->espera 1000ms, intento1->falla->espera 2000ms, intento2->éxito.
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    const res = await promise

    expect(callCount).toBe(3)
    expect(res.status).toBe(200)
  })

  it('abre el circuit breaker tras 5 fallos consecutivos y rechaza llamadas posteriores con GeminiCircuitOpenError (sin SLM local configurado)', async () => {
    const { fetchGeminiWithRetry, GeminiCircuitOpenError } = await freshGeminiModule()
    global.fetch = vi.fn(async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch

    // maxRetries=0: cada llamada cuenta como UN fallo consecutivo, sin esperar backoff.
    for (let i = 0; i < 5; i++) {
      const res = await fetchGeminiWithRetry('https://fake-gemini.test/generate', {}, new AbortController().signal, 0)
      expect(res.status).toBe(429) // el circuito recién se abre DESPUÉS del 5º fallo, esta respuesta aún es la real
    }

    // 6ª llamada: el circuito ya está abierto (FAILURE_THRESHOLD=5 alcanzado en la 5ª).
    await expect(
      fetchGeminiWithRetry('https://fake-gemini.test/generate', {}, new AbortController().signal, 0),
    ).rejects.toThrow(GeminiCircuitOpenError)
  })

  it('con el circuito abierto Y un SLM local configurado, las llamadas posteriores enrutan al SLM local SIN volver a llamar a Gemini (patrón Circuit Breaker + Fallback)', async () => {
    // Fase 1: abre el circuito con 5 fallos consecutivos SIN SLM local
    // configurado todavía — aísla "abrir el circuito" de "hacer fallback",
    // para no confundir dos comportamientos distintos del mismo archivo
    // (retry-agotado-con-SLM-configurado ya se prueba en el test siguiente).
    const { fetchGeminiWithRetry } = await freshGeminiModule()
    let geminiCalls = 0
    let localSlmCalls = 0
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('fake-gemini.test')) {
        geminiCalls++
        return new Response('service unavailable', { status: 503 })
      }
      if (String(url).includes('localhost:11434')) {
        localSlmCalls++
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'respuesta del modelo local' } }] }),
          { status: 200 },
        )
      }
      throw new Error(`fetch inesperado a ${url}`)
    }) as unknown as typeof fetch

    for (let i = 0; i < 5; i++) {
      await fetchGeminiWithRetry('https://fake-gemini.test/generate', { contents: [{ parts: [{ text: 'pregunta' }] }] }, new AbortController().signal, 0)
    }
    expect(geminiCalls).toBe(5)
    expect(localSlmCalls).toBe(0) // sin LOCAL_SLM_URL todavía, ningún fallback debió dispararse

    // Fase 2: el circuito YA está abierto (5º fallo lo abrió). Ahora se
    // configura LOCAL_SLM_URL y se llama de nuevo — con el circuito abierto,
    // isCircuitOpen() es true ANTES de intentar fetch a Gemini, así que la
    // llamada debe ir directo al SLM local sin tocar `fetch` a Gemini.
    setDenoEnv({ LOCAL_SLM_URL: 'http://localhost:11434', LOCAL_SLM_MODEL: 'llama3' })
    const res = await fetchGeminiWithRetry(
      'https://fake-gemini.test/generate',
      { contents: [{ parts: [{ text: 'pregunta tras circuito abierto' }] }] },
      new AbortController().signal,
      0,
    )
    const json = await res.json()

    expect(geminiCalls).toBe(5) // NO aumentó: no volvió a llamar a Gemini con el circuito abierto
    expect(localSlmCalls).toBe(1)
    expect(json._localSlmFallback).toBe(true)
    expect(json.candidates[0].content.parts[0].text).toBe('respuesta del modelo local')
  })

  it('reintentos agotados con 429 persistente y SLM local configurado → se degrada al SLM local en vez de devolver el 429 silenciosamente', async () => {
    const { fetchGeminiWithRetry } = await freshGeminiModule({ LOCAL_SLM_URL: 'http://localhost:11434' })
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('fake-gemini.test')) return new Response('rate limited', { status: 429 })
      return new Response(JSON.stringify({ choices: [{ message: { content: 'fallback ok' } }] }), { status: 200 })
    }) as unknown as typeof fetch

    const promise = fetchGeminiWithRetry('https://fake-gemini.test/generate', { contents: [] }, new AbortController().signal, 1)
    await vi.advanceTimersByTimeAsync(1000)
    const res = await promise
    const json = await res.json()
    expect(json._localSlmFallback).toBe(true)
  })
})
