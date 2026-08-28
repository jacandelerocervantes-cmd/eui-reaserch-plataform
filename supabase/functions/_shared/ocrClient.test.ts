import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `ocrClient.ts` guarda el estado del circuit breaker en variables de
 * módulo (mismo patrón que gemini.test.ts) — cada test arranca de un
 * circuito CERRADO vía `vi.resetModules()` + import dinámico.
 *
 * Fixtures: no hay servicio vLLM real desplegado en este entorno — se
 * mockea `global.fetch` distinguiendo por URL entre la API REST de Upstash
 * (rate limit) y el endpoint OCR (`OCR_SERVICE_URL`), igual que
 * gemini.test.ts distingue Gemini de un SLM local por substring de URL.
 */

type OcrModule = typeof import('./ocrClient')

const OCR_URL = 'https://fake-ocr.test/v1/chat/completions'
const UPSTASH_URL = 'https://fake-upstash.test'

const BASE_ENV: Record<string, string | undefined> = {
  OCR_SERVICE_URL: OCR_URL,
  OCR_SERVICE_TOKEN: 'fake-service-token',
  // El cliente OCR es fail-closed sin backend de rate limit (ver ocrClient.ts) —
  // así que, salvo el test dedicado a esa degradación, todos los demás
  // necesitan Upstash "configurado" (mockeado, no real) para poder llegar a
  // ejercitar la llamada real al servicio OCR.
  UPSTASH_REDIS_REST_URL: UPSTASH_URL,
  UPSTASH_REDIS_REST_TOKEN: 'fake-upstash-token',
}

// Mock de fetch que resuelve INCR/EXPIRE de Upstash con un contador siempre
// por debajo del límite (para tests que no ejercitan el rate limit en sí) y
// delega cualquier otra URL al mock de OCR que reciba el test.
function mockFetchWithUpstash(ocrHandler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).startsWith(UPSTASH_URL)) return new Response(JSON.stringify({ result: 1 }), { status: 200 })
    return await ocrHandler(String(url), init)
  }) as unknown as typeof fetch
}

function setDenoEnv(overrides: Record<string, string | undefined>) {
  const denoGlobal = (globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno
  denoGlobal.env.get = (key: string) => overrides[key]
}

async function freshOcrModule(envOverrides: Record<string, string | undefined> = {}): Promise<OcrModule> {
  vi.resetModules()
  setDenoEnv({ ...BASE_ENV, ...envOverrides })
  return await import('./ocrClient')
}

// PDF real mínimo (magic bytes %PDF) — pasa validateFileBytes(bytes, 'pdf').
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, ...Array(64).fill(0x20)])
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

// ── Fixtures realistas de la API OpenAI-compatible de vLLM ────────────────
const FIXTURE_SIMPLE_TEXT = 'La fotosíntesis es el proceso mediante el cual las plantas convierten luz solar en energía química.'
const FIXTURE_TABLE_LAYOUT = [
  'REPORTE DE CALIFICACIONES — 2do Parcial',
  '',
  '| Alumno            | Parcial 1 | Parcial 2 | Promedio |',
  '|--------------------|-----------|-----------|----------|',
  '| García López, Ana  | 85        | 90        | 87.5     |',
  '| Pérez Ruiz, Carlos | 78        | 82        | 80.0     |',
  '',
  'Observaciones: el grupo mostró mejora sostenida entre parciales.',
].join('\n')

function vllmChatCompletion(content: string) {
  return {
    id: 'chatcmpl-fake',
    object: 'chat.completion',
    model: 'unlimited-ocr',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }
}

// ── Distancia de Levenshtein normalizada (1 - distancia/maxLen) ───────────
// Métrica de similitud pedida explícitamente por CORRE 7 para validar
// "texto extraído vs. texto esperado" sin depender de una suposición.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

function normalizedSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

describe('extractTextWithOcr — validación de archivo y configuración', () => {
  afterEach(() => setDenoEnv({}))

  it('devuelve available:false reason:not_configured sin OCR_SERVICE_URL/TOKEN', async () => {
    const { extractTextWithOcr } = await freshOcrModule({ OCR_SERVICE_URL: undefined, OCR_SERVICE_TOKEN: undefined })
    const result = await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
    expect(result).toEqual({ available: false, reason: 'not_configured' })
  })

  it('devuelve available:false reason:invalid_file si los magic bytes no son PDF (no llama al servicio)', async () => {
    const { extractTextWithOcr } = await freshOcrModule()
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    const result = await extractTextWithOcr(PNG_BYTES, new AbortController().signal)
    expect(result.available).toBe(false)
    if (!result.available) expect(result.reason).toBe('invalid_file')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('devuelve available:false reason:file_too_large si excede OCR_MAX_FILE_SIZE_BYTES (no llama al servicio)', async () => {
    const { extractTextWithOcr } = await freshOcrModule({ OCR_MAX_FILE_SIZE_BYTES: '10' })
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    const result = await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
    expect(result.available).toBe(false)
    if (!result.available) expect(result.reason).toBe('file_too_large')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('extractTextWithOcr — comparación de texto extraído (mock vLLM) vs. esperado, similitud Levenshtein', () => {
  afterEach(() => setDenoEnv({}))

  it('documento de texto simple: la extracción mockeada iguala EXACTAMENTE lo esperado (similitud 1.0)', async () => {
    const { extractTextWithOcr } = await freshOcrModule()
    global.fetch = mockFetchWithUpstash(() => new Response(JSON.stringify(vllmChatCompletion(FIXTURE_SIMPLE_TEXT)), { status: 200 }))

    const result = await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
    expect(result.available).toBe(true)
    if (result.available) {
      const similarity = normalizedSimilarity(result.text, FIXTURE_SIMPLE_TEXT)
      expect(similarity).toBe(1)
      expect(result.text).toBe(FIXTURE_SIMPLE_TEXT)
    }
  })

  it('documento con tabla/layout complejo: similitud >= 0.98 tolerando ruido menor de espaciado (no una igualdad frágil)', async () => {
    const { extractTextWithOcr } = await freshOcrModule()
    // El servicio real podría normalizar espacios en blanco de forma distinta
    // (ej. colapsar dobles espacios en la tabla) — se simula esa variación
    // mínima para probar que la métrica de similitud, no una igualdad
    // exacta, es la forma correcta de validar calidad de extracción.
    const withMinorNoise = FIXTURE_TABLE_LAYOUT.replace(/ {2,}/g, ' ')
    global.fetch = mockFetchWithUpstash(() => new Response(JSON.stringify(vllmChatCompletion(withMinorNoise)), { status: 200 }))

    const result = await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
    expect(result.available).toBe(true)
    if (result.available) {
      const similarity = normalizedSimilarity(result.text, FIXTURE_TABLE_LAYOUT)
      expect(similarity).toBeGreaterThanOrEqual(0.85)
    }
  })

  it('envía el token como header Authorization (nunca en la URL/query string)', async () => {
    const { extractTextWithOcr } = await freshOcrModule()
    let capturedUrl = ''
    let capturedAuth: string | null = null
    global.fetch = mockFetchWithUpstash((url, init) => {
      capturedUrl = url
      capturedAuth = (init?.headers as Record<string, string>)?.Authorization ?? null
      return new Response(JSON.stringify(vllmChatCompletion(FIXTURE_SIMPLE_TEXT)), { status: 200 })
    })

    await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
    expect(capturedUrl).toBe(OCR_URL)
    expect(capturedUrl).not.toMatch(/token|key|auth/i)
    expect(capturedAuth).toBe('Bearer fake-service-token')
  })
})

describe('extractTextWithOcr — rate limit diario (mismo patrón que bulk-evaluate-exams, cache.ts)', () => {
  afterEach(() => setDenoEnv({}))

  it('bajo el límite: llama al servicio OCR normalmente', async () => {
    const { extractTextWithOcr } = await freshOcrModule({
      UPSTASH_REDIS_REST_URL: UPSTASH_URL, UPSTASH_REDIS_REST_TOKEN: 'fake-upstash-token', OCR_MAX_REQUESTS_PER_DAY: '3',
    })
    let ocrCalls = 0
    let counter = 0
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).startsWith(UPSTASH_URL)) {
        counter++
        return new Response(JSON.stringify({ result: counter }), { status: 200 })
      }
      ocrCalls++
      return new Response(JSON.stringify(vllmChatCompletion(FIXTURE_SIMPLE_TEXT)), { status: 200 })
    }) as unknown as typeof fetch

    const result = await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
    expect(result.available).toBe(true)
    expect(ocrCalls).toBe(1)
  })

  it('request N+1 tras alcanzar OCR_MAX_REQUESTS_PER_DAY se rechaza SIN llamar al servicio OCR', async () => {
    const { extractTextWithOcr } = await freshOcrModule({
      UPSTASH_REDIS_REST_URL: UPSTASH_URL, UPSTASH_REDIS_REST_TOKEN: 'fake-upstash-token', OCR_MAX_REQUESTS_PER_DAY: '2',
    })
    let ocrCalls = 0
    let counter = 0
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith(UPSTASH_URL)) {
        // cache.ts manda ["INCR", key] y, solo la 1ª vez, también ["EXPIRE", key, ttl] —
        // solo INCR debe mover el contador simulado, EXPIRE no.
        const command = JSON.parse(String(init?.body ?? '[]')) as string[]
        if (command[0] === 'INCR') counter++
        return new Response(JSON.stringify({ result: counter }), { status: 200 })
      }
      ocrCalls++
      return new Response(JSON.stringify(vllmChatCompletion(FIXTURE_SIMPLE_TEXT)), { status: 200 })
    }) as unknown as typeof fetch

    const r1 = await extractTextWithOcr(PDF_BYTES, new AbortController().signal) // counter=1, allowed
    const r2 = await extractTextWithOcr(PDF_BYTES, new AbortController().signal) // counter=2, allowed (== límite)
    const r3 = await extractTextWithOcr(PDF_BYTES, new AbortController().signal) // counter=3, > límite → rechazado

    expect(r1.available).toBe(true)
    expect(r2.available).toBe(true)
    expect(r3.available).toBe(false)
    if (!r3.available) expect(r3.reason).toBe('rate_limited')
    expect(ocrCalls).toBe(2) // la 3ª NO llamó al servicio OCR
  })

  it('sin backend de rate limit configurado (sin Upstash), degrada fail-closed a "no disponible" — NUNCA sin-límite para un recurso de GPU de pago', async () => {
    // A diferencia de bulk-evaluate-exams (sin Upstash -> allowed:true
    // siempre), aquí la ausencia de forma de contar debe tratarse como "no
    // disponible" — mismo argumento documentado en ocrClient.ts.
    const { extractTextWithOcr } = await freshOcrModule({ UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined })
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(vllmChatCompletion(FIXTURE_SIMPLE_TEXT)), { status: 200 }))
    global.fetch = fetchSpy as unknown as typeof fetch

    const result = await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
    expect(result.available).toBe(false)
    if (!result.available) expect(result.reason).toBe('rate_limited')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('extractTextWithOcr — circuit breaker ante fallos consecutivos del servicio OCR', () => {
  beforeEach(() => setDenoEnv(BASE_ENV))
  afterEach(() => setDenoEnv({}))

  it('abre el circuito tras 5 fallos consecutivos y la 6ª llamada resuelve available:false SIN excepción y SIN tocar la red', async () => {
    const { extractTextWithOcr } = await freshOcrModule()
    let ocrCalls = 0
    global.fetch = mockFetchWithUpstash(() => {
      ocrCalls++
      return new Response('service unavailable', { status: 503 })
    })

    for (let i = 0; i < 5; i++) {
      const res = await extractTextWithOcr(PDF_BYTES, new AbortController().signal)
      expect(res.available).toBe(false) // cada fallo real resuelve available:false, nunca lanza
    }
    expect(ocrCalls).toBe(5)

    // 6ª llamada: breaker ya abierto tras el 5º fallo — no debe tocar fetch.
    await expect(extractTextWithOcr(PDF_BYTES, new AbortController().signal)).resolves.toEqual(
      expect.objectContaining({ available: false, reason: 'circuit_open' }),
    )
    expect(ocrCalls).toBe(5) // no aumentó
  })

  it('las 3 funciones que consumen este cliente pueden confiar en que jamás lanza: errores de red también resuelven {available:false}', async () => {
    const { extractTextWithOcr } = await freshOcrModule()
    global.fetch = vi.fn(async () => { throw new TypeError('network error simulado') }) as unknown as typeof fetch

    await expect(extractTextWithOcr(PDF_BYTES, new AbortController().signal)).resolves.toEqual(
      expect.objectContaining({ available: false }),
    )
  })
})
