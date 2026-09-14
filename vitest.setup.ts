import 'fake-indexeddb/auto'

// Shim mínimo de `Deno.env` para que los módulos de supabase/functions/_shared
// (escritos para Deno Deploy, algunos leen Deno.env.get a nivel de módulo)
// puedan importarse bajo vitest/node sin lanzar ReferenceError. Sin variables
// reales configuradas, isLocalSlmConfigured()/isDistributedStateConfigured()
// devuelven false — mismo comportamiento "sin backend externo" que en dev.
if (typeof (globalThis as unknown as { Deno?: unknown }).Deno === 'undefined') {
  ;(globalThis as unknown as { Deno: { env: { get: (key: string) => string | undefined } } }).Deno = {
    env: { get: () => undefined },
  }
}
