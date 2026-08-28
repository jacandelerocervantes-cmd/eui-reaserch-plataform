/**
 * Wrapper sobre el endpoint de embeddings de Gemini (text-embedding-004,
 * 768 dimensiones) — usado por el pipeline GraphRAG para vectorizar nodos
 * del grafo de conocimiento y consultas de búsqueda semántica.
 */

const EMBEDDING_MODEL = "text-embedding-004"
const EMBEDDING_DIMENSIONS = 768

export async function embedText(
  text: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      }),
      signal,
    },
  )

  if (!res.ok) throw new Error(`Gemini embeddings respondió ${res.status}`)
  const json = await res.json()
  const values: number[] | undefined = json.embedding?.values
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding inválido: se esperaban ${EMBEDDING_DIMENSIONS} dimensiones.`)
  }
  return values
}

/** pgvector espera el literal `[0.1,0.2,...]` como texto, no un array JS. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`
}
