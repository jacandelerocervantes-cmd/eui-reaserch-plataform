/**
 * Suma los pesos ponderados de una colección de elementos.
 */
export function sumWeights(items: { weight: number | string }[]): number {
  return items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
}

/**
 * Valida si la suma ponderada alcanza el 100% considerando una pequeña tolerancia
 * para evitar fallas por imprecisión de coma flotante en JavaScript.
 */
export function isWeightComplete(total: number, tolerance = 0.01): boolean {
  return Math.abs(total - 100) < tolerance;
}

