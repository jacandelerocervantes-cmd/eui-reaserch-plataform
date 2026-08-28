/**
 * Matemática pura de validate-ai-grading (mds/03 tarea 2), separada del glue
 * de Deno (`serve`, Supabase client) para poder testearla con vitest/node sin
 * arrastrar imports de deno.land — este archivo no importa nada de Deno.
 *
 * R² = 1 - SS_res/SS_tot,  SS_res = Σ(y_i - ŷ_i)²,  SS_tot = Σ(y_i - ȳ)²
 * RMSE = sqrt( (1/n) Σ(y_i - ŷ_i)² )
 * donde y_i = nota humana (verdad), ŷ_i = predicción de la IA.
 */

export const MIN_SAMPLES_PER_GROUP = 3

export interface Pair {
  group_id: string
  y: number
  yhat: number
}

export function computeR2AndRmse(pairs: Pair[]): { r2: number | null; rmse: number } {
  const n = pairs.length
  const meanY = pairs.reduce((s, p) => s + p.y, 0) / n
  const ssRes = pairs.reduce((s, p) => s + (p.y - p.yhat) ** 2, 0)
  const ssTot = pairs.reduce((s, p) => s + (p.y - meanY) ** 2, 0)
  const rmse = Math.sqrt(ssRes / n)
  // ssTot=0 (todas las notas humanas idénticas) hace R² indefinido, no 1 ni 0 — se reporta null en vez de fabricar un número.
  const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot
  return { r2, rmse }
}

export function filterByMinGroupSize(pairs: Pair[], minSize: number): Pair[] {
  const counts = new Map<string, number>()
  for (const p of pairs) counts.set(p.group_id, (counts.get(p.group_id) ?? 0) + 1)
  return pairs.filter((p) => (counts.get(p.group_id) ?? 0) >= minSize)
}
