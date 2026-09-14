# Entorno de Pruebas — pendiente (roadmap)

Documento de planificación, **no ejecutado todavía**. Se generó durante el
cierre de Módulo 01_B al intentar una prueba end-to-end real del flujo de
examen y toparse con dos bloqueos reales de infraestructura (no de código).
Sirve como punto de partida para no repetir el diagnóstico cuando se retome.

---

## 1. Bloqueos reales encontrados (por qué no se pudo hacer ahora)

### 1.1 Sin backend real disponible
`.env.local` tiene credenciales Supabase placeholder
(`https://placeholder.supabase.co`). No hay proyecto Supabase real conectado
en este entorno, así que ninguna llamada a `supabase.from(...)` puede
completarse de verdad.

### 1.2 Login es solo Google OAuth
[lib/supabase.ts:22](../lib/supabase.ts) (`signInWithGoogle` →
`supabase.auth.signInWithOAuth`) es el único método de autenticación de la
app. Un test end-to-end real por navegador tendría que pasar por la
pantalla de consentimiento de Google — eso requiere escribir un
usuario/contraseña real de Google, algo que un agente no debe hacer
(regla de seguridad: no autenticarse con credenciales de terceros).

### 1.3 Sin Docker en este entorno
`supabase/` ya tiene `config.toml` + migraciones reales — en teoría
`supabase start` levantaría un stack local completo (Postgres, Auth, etc.)
para sembrar datos de prueba y probar sin depender de un proyecto en la
nube. Pero requiere Docker Desktop, que no está instalado en esta máquina
(`docker: command not found`).

### 1.4 Alias `@/*` no resuelve en Vitest
`vitest.config.ts` no define `resolve.alias` — solo `tsconfig.json` conoce
`"@/*": ["./*"]` ([tsconfig.json:21](../tsconfig.json)). Cualquier test que
importe algo vía `@/lib/...` (como
`app/.../_hooks/useExamSession.ts`, que importa `@/lib/supabase`) falla en
Vitest con `Failed to resolve import "@/lib/supabase"`, aunque `tsc` y
`next build` sí lo resuelven bien. Confirmado en esta sesión al intentar
correr un test del hook — se revirtió el test para no dejar la suite en
rojo (`npm test` pasó de 3/3 suites a 1 fallida).

---

## 2. Cómo desbloquear cada punto (para cuando se retome)

| Bloqueo | Solución concreta |
|---|---|
| 1.1 backend real | Crear un proyecto Supabase gratuito de **prueba** (no el de producción), aplicar las migraciones de `supabase/migrations/` contra él, y poner su URL + anon key en `.env.local`. |
| 1.2 login solo Google | No usar la UI de login para el test. Con la **service_role key** del proyecto de prueba (nunca se comparte en el chat, se pone directo en `.env.local`), generar un token de sesión válido vía la API admin de Supabase (`auth.admin.generateLink` o similar) para un alumno de prueba, e inyectarlo en `localStorage` del navegador antes de navegar a la ruta protegida — evita por completo la pantalla de Google. |
| 1.3 sin Docker | O se instala Docker Desktop (gratuito) y se corre `supabase start` localmente, o se usa directamente el proyecto Supabase de prueba en la nube (opción 1.1) — no son excluyentes, cualquiera de las dos resuelve el backend real. |
| 1.4 alias en Vitest | Agregar a `vitest.config.ts`: `resolve: { alias: { '@': path.resolve(__dirname, '.') } }` (mismo patrón que usa `next.config.ts` internamente vía `tsconfig`). Una vez agregado, cualquier test que importe `@/lib/...` o `@/components/...` debería resolver igual que en `next build`. |

---

## 3. Roadmap de lo que falta testear (por módulo)

Todo lo de abajo son **rutas/hooks reales del repo hoy**, sin test
automatizado ni prueba manual E2E confirmada. Orden sugerido: de menor a
mayor riesgo (igual que se hizo con la división de archivos en
Módulo 01_B).

### 3.1 Alumno — flujo de examen (`presentar/[examId]`)
- [ ] Arreglar `vitest.config.ts` (punto 2, fila 1.4) — bloqueante para todo lo demás de esta sección.
- [ ] Recuperar/rehacer el test de `_hooks/useExamSession.ts` (timer, 3ra incidencia → bloqueo automático, envío con preguntas incompletas) — ya se escribió una vez en esta sesión y se revirtió solo por el bloqueo de alias; el diseño (mock de `@/lib/supabase` con builder thenable, `@vitest-environment jsdom`, `vi.useFakeTimers`) ya está probado y se puede reconstruir directo.
- [ ] Prueba manual en navegador real (con sesión de alumno de prueba, punto 2 filas 1.1/1.2): iniciar examen, responder cada `q_type` (multiple_choice, true_false, open, matching, short_answer, fill_blank, ordering, multi_select), forzar cambio de pestaña / copiar / salir de fullscreen y confirmar que el conteo de incidencias y el mensaje de advertencia son correctos, dejar que el timer llegue a 0 y confirmar entrega automática.

### 3.2 Alumno — entrega de tareas (`entregar/[assignmentId]`)
- [ ] Test de `_services/fetchAssignment.tsx` (maneja los distintos estados: sin entrega, con entrega, con feedback del docente).
- [ ] Prueba manual: subir archivo (`FileZone`), publicar en el foro (`ForumZone`), reentregar después de feedback.

### 3.3 Docente — calificaciones (`(docente)/panel/materias/[id]/calificaciones`)
- [ ] Test de `_hooks/useCalificaciones.ts` (crear/editar unidad, actividad, criterios de evaluación, cálculo de la sábana de calificaciones).
- [ ] Prueba manual de las 4 vistas (`UnitsView`, `CaptureView`, `FinalGradesView`, `SabanaView`) con datos reales de un curso de prueba.

### 3.4 Docente — evaluaciones (fuera de alcance de 01_B, no se tocó en el split de archivos pero comparte el mismo riesgo)
- [ ] `evaluaciones/[examId]/configuracion` — creación/edición del examen que el alumno termina presentando en 3.1.
- [ ] `evaluaciones/[examId]/simulacion` — vista previa del docente.
- [ ] `evaluaciones/[examId]/resultados` y `revision/[studentId]` — calificación y revisión, incluyendo el `score_ia` (calificación asistida por IA) que aparece en `ExistingResponse`.

### 3.5 Importación inteligente (`components/modals/ImportModal.tsx`)
- [ ] Ya se corrigió el bug de CSS (ver `docs/01_B_Refactor_y_Diseno_Base.md §1`), pero sigue sin prueba funcional del flujo real (subir lista de alumnos vía Gemini, ver feedback de drag&drop, confirmar importación).

---

## 4. Alcance explícito de este documento

Esto es **solo un mapa**, no un compromiso de que todo se hará en la
próxima sesión — es para que la siguiente pasada de testing no tenga que
re-descubrir estos 4 bloqueos ni re-diseñar el mock de Supabase desde cero.
No se ha ejecutado nada de la sección 3 todavía.
