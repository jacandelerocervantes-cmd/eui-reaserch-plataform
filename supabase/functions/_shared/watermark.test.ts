import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REDUNDANCY,
  TextoDemasiadoCortoError,
  capacityReport,
  decode,
  encode,
  scanForAnyWatermark,
} from './watermark'

// Port a TypeScript de D-watermark-integridad-academica/watermark_codec.py
// (CORRE 9) — este test cubre las mismas verificaciones "core" que
// D-watermark-integridad-academica/tests/test_watermark.py: capacidad
// matemática, encode→decode a 100% de densidad, densidad proporcional ante
// edición parcial (no todo-o-nada), y ausencia de falsos positivos.

const BASE_SENTENCE =
  'La fotosintesis es el proceso mediante el cual las plantas verdes y ' +
  'algunos otros organismos transforman la energia luminosa en energia ' +
  'quimica almacenada en moleculas de glucosa utilizando dioxido de ' +
  'carbono y agua como materias primas y liberando oxigeno como ' +
  'subproducto de esta reaccion bioquimica fundamental para la vida '

function longText(minWords: number): string {
  let text = ''
  while (text.split(/\s+/).filter(Boolean).length < minWords) text += BASE_SENTENCE
  return text.trim()
}

// Identificador corto (uso real: primeros 6-8 hex del uuid de la actividad,
// ver create-assignment-hub/index.ts) con redundancy=1 — el mismo caso de
// uso que se conecta en producción (activityId.slice(0,8), redundancy=1),
// para que este test también sirva de evidencia de que la capacidad
// requerida es realista para una descripción de actividad.
const IDENTIFIER = 'a1b2c3d4'
const REDUNDANCY = 1

function sampleText(): string {
  const needed = capacityReport(IDENTIFIER, REDUNDANCY).min_words_required
  return longText(needed + 50)
}

describe('_shared/watermark — capacidad', () => {
  it('capacityReport calcula la misma fórmula que el módulo Python (16 + 8*L por copia)', () => {
    const report = capacityReport(IDENTIFIER, DEFAULT_REDUNDANCY)
    const expectedFrameBits = 16 + 8 * new TextEncoder().encode(IDENTIFIER).length
    expect(report.frame_bits).toBe(expectedFrameBits)
    expect(report.total_bits_needed).toBe(report.frame_bits * DEFAULT_REDUNDANCY)
    expect(report.min_words_required).toBe(1 + report.total_bits_needed)
  })

  it('encode() rechaza un texto justo por debajo del mínimo de palabras requerido', () => {
    const report = capacityReport(IDENTIFIER, DEFAULT_REDUNDANCY)
    const words = longText(report.min_words_required - 1)
      .split(/\s+/)
      .slice(0, report.min_words_required - 1)
    const tooShort = words.join(' ')

    expect(() => encode(tooShort, IDENTIFIER, DEFAULT_REDUNDANCY)).toThrow(TextoDemasiadoCortoError)
  })

  it('con redundancy=1 e identificador corto, el mínimo de palabras es realista para una instrucción de actividad', () => {
    const report = capacityReport(IDENTIFIER, REDUNDANCY)
    // frame_bits = 16 + 8*8 = 80 -> min_words = 1 + 80 = 81, muy por debajo
    // de los ~500+ que exige redundancy=6 por defecto.
    expect(report.min_words_required).toBeLessThan(100)
  })
})

describe('_shared/watermark — encode/decode', () => {
  it('watermark completo decodifica al 100% de densidad', () => {
    const text = sampleText()
    const watermarked = encode(text, IDENTIFIER, REDUNDANCY)

    const result = decode(watermarked, IDENTIFIER, REDUNDANCY)

    expect(result.has_watermark).toBe(true)
    expect(result.identifier).toBe(IDENTIFIER)
    expect(result.symbols_matched).toBe(result.symbols_expected)
    expect(result.density_percent).toBe(100.0)
  })

  it('el texto en claro (sin símbolos invisibles) es idéntico a las palabras originales', () => {
    const text = sampleText()
    const watermarked = encode(text, IDENTIFIER, REDUNDANCY)
    const stripped = Array.from(watermarked)
      .filter((c) => c !== '​' && c !== '‍' && c !== '‌')
      .join('')
    expect(stripped).toBe(text.split(/\s+/).filter(Boolean).join(' '))
  })

  it('texto sin watermark no genera falso positivo', () => {
    const plainText = longText(50)

    const result = decode(plainText, IDENTIFIER, REDUNDANCY)

    expect(result.has_watermark).toBe(false)
    expect(result.identifier).toBeNull()
    expect(result.symbols_matched).toBe(0)
    expect(result.density_percent).toBe(0.0)
    expect(scanForAnyWatermark(plainText)).toEqual([])
  })

  it('decodificar con un identificador esperado distinto no llega a densidad 100% (LCS no es una coincidencia exacta)', () => {
    // Nota: decode() mide similitud por LCS entre la secuencia de símbolos
    // esperada y la extraída, no una comparación de identidad — con un
    // alfabeto de solo 3 símbolos algo de coincidencia parcial por azar es
    // posible incluso con el identificador "equivocado" (mismo comportamiento
    // que el módulo Python: `decode()` no es una prueba forense exacta, ver
    // la advertencia en watermark.ts). Lo que sí debe cumplirse siempre es
    // que NO alcance el 100% de densidad que sí obtiene el identificador
    // correcto en el test anterior.
    const text = sampleText()
    const watermarked = encode(text, IDENTIFIER, REDUNDANCY)

    const result = decode(watermarked, 'otroident', REDUNDANCY)

    expect(result.density_percent).toBeLessThan(100.0)
  })
})

describe('_shared/watermark — densidad ante edición parcial', () => {
  function editFraction(words: string[], fraction: number, seed: number): string {
    // PRNG determinista simple (mulberry32) para reproducibilidad, análogo a
    // random.Random(42) en el test Python.
    let s = seed
    const rand = () => {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const edited = [...words]
    const nToEdit = Math.floor(edited.length * fraction)
    const indices = new Set<number>()
    while (indices.size < nToEdit) indices.add(Math.floor(rand() * edited.length))
    for (const i of indices) {
      const stripped = edited[i].replace(/[^a-zA-Z0-9]/g, '')
      edited[i] = stripped || 'x'
    }
    return edited.join(' ')
  }

  it('la densidad decodificada baja de forma monotónica y proporcional, no todo-o-nada', () => {
    const text = sampleText()
    const watermarked = encode(text, IDENTIFIER, REDUNDANCY)
    const words = watermarked.split(' ')

    const fractions = [0.0, 0.15, 0.3, 0.5, 0.7, 0.9]
    const densities = fractions.map((frac) => {
      const editedText = frac === 0.0 ? watermarked : editFraction(words, frac, 42)
      return decode(editedText, IDENTIFIER, REDUNDANCY).density_percent
    })

    expect(densities[0]).toBe(100.0)

    for (let i = 1; i < densities.length; i++) {
      expect(densities[i]).toBeLessThanOrEqual(densities[i - 1])
    }

    // Proporcional a la predicción lineal density(p) ~= 100*(1-p), dentro de
    // un margen razonable — misma tolerancia que el test Python (±20 pts).
    fractions.forEach((frac, i) => {
      const predicted = 100 * (1 - frac)
      expect(Math.abs(densities[i] - predicted)).toBeLessThanOrEqual(20)
    })

    // Evidencia explícita de que NO es todo-o-nada: con solo 15% de palabras
    // editadas debe seguir quedando una fracción sustancial del watermark.
    const lightResult = decode(editFraction(words, 0.15, 42), IDENTIFIER, REDUNDANCY)
    expect(lightResult.density_percent).toBeGreaterThan(50.0)
  })
})
