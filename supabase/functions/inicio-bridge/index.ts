// Importación usando el alias definido en import_map.json
import { serve } from "std/http/server.ts"

const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL") || "TU_URL_AQUI"

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 'Access-Control-Allow-Origin': '*' } 
    })
  }

  try {
    const { action, payload } = await req.json()
    console.log(`[BRIDGE] Intentando acción: ${action}`)

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "TU_URL_AQUI") {
      throw new Error("Configuración faltante: APPS_SCRIPT_URL")
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })

    const result = await response.json()
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200
    })

  } catch (err) {
    // Manejo seguro del tipo 'unknown'
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[BRIDGE ERROR]: ${msg}`)
    
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500
    })
  }
})