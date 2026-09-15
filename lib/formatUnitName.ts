/**
 * Formatea el título/etiqueta de una unidad académica para evitar redundancias como "Unidad 1: Unidad 1".
 * Si el nombre ya coincide con "Unidad X" o empieza con "unidad", devuelve "Unidad X".
 * De lo contrario, devuelve "Unidad X: {nombre}".
 */
export function formatUnitTitle(unitNumber: number, name?: string | null): string {
  const trimmed = (name || "").trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower.startsWith("unidad") || lower === `u${unitNumber}`) {
    return `Unidad ${unitNumber}`;
  }
  return `Unidad ${unitNumber}: ${trimmed}`;
}

