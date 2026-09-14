# Módulo 01_B — Refactor y Diseño Base

Auditoría real del código (no del historial de sesiones previas). Manual de
diseño y árbol objetivo ya publicados en
[ARCHITECTURE_AND_DESIGN.md](../ARCHITECTURE_AND_DESIGN.md) (Tareas 1, 4 y 5
del módulo, completas). Este documento cubre las Tareas 2 y 3: el estado
real encontrado, lo que ya se corrigió, y lo que falta por ejecutar.

---

## 1. Hallazgo real corregido: `ImportModal` sin estilos en producción

Al auditar los componentes base para extraer el manual de diseño, se
detectó que [components/modals/ImportModal.module.css](../components/modals/ImportModal.module.css)
contenía el CSS del **Sidebar** (`.sidebar`, `.nav`, `.aiSection`,
`@keyframes geminiBreath`...) — ningún nombre de clase coincidía con los que
usa [ImportModal.tsx](../components/modals/ImportModal.tsx)
(`styles.overlay`, `styles.modal`, `styles.dropZone`, `styles.aiBadge`,
etc.). Resultado: el modal de **"Importación Inteligente"** (el que usan los
docentes para subir listas de alumnos vía Gemini) se renderizaba sin ningún
estilo — sin overlay, sin tarjeta, sin feedback visual de drag&drop — en
producción, para los 1000+ usuarios reales.

**Corregido**: se reescribió `ImportModal.module.css` con las clases reales
que el componente usa, siguiendo el mismo lenguaje visual que
`CourseModal.module.css` (overlay + tarjeta) y el acento violeta de IA que
usa `FloatingCopilot.module.css` (`#8b5cf6` / gradiente `#6366f1→#a855f7`).
Verificado con `tsc --noEmit` sin errores.

## 2. Auditoría de límites de línea (Tarea 3)

Regla: 400 líneas (alta complejidad) / 200 (baja complejidad), tolerancia
+20% → 480 / 240.

**Componentes compartidos (`components/`)** — los evalué contra el límite
bajo (200/240) por ser UI reusable sin orquestación de datos propia: **cero
violaciones**. El más grande es `Sidebar.tsx` con 229 líneas, dentro de
tolerancia.

**Páginas (`app/`)** — evaluadas contra el límite alto (400/480) por
contener lógica de negocio real (fetch, estado, validación). **3
violaciones reales**, confirmadas por conteo de línea, no por estimación:

| Archivo | Líneas | Exceso sobre 480 |
|---|---|---|
| [app/alumno/materia/[id]/presentar/[examId]/page.tsx](../app/alumno/materia/%5Bid%5D/presentar/%5BexamId%5D/page.tsx) | 816 | +336 |
| [app/alumno/materia/[id]/entregar/[assignmentId]/page.tsx](../app/alumno/materia/%5Bid%5D/entregar/%5BassignmentId%5D/page.tsx) | 586 | +106 |
| [app/(docente)/panel/materias/[id]/calificaciones/page.tsx](../app/\(docente\)/panel/materias/%5Bid%5D/calificaciones/page.tsx) | 485 | +5 |

(~15 archivos adicionales están entre 250-480 líneas — dentro de tolerancia,
no requieren acción; no se listan por no ser violaciones.)

### 2.1 Plan de división por archivo — ejecutado y verificado

Los 3 archivos se dividieron siguiendo exactamente el plan de abajo, en
orden de menor a mayor riesgo. Después de cada uno: `tsc --noEmit` limpio,
`eslint` sin regresiones nuevas (mismos 9 problemas preexistentes, ninguno
introducido), `vitest` 3/3, y al final `npm run build` generó las 66 rutas
sin error, incluyendo las 3 tocadas. Cero archivos por encima de 480 líneas
en todo el repo tras el cambio (verificado por conteo, no por muestreo).

| Archivo | Antes | Después | Extraído a |
|---|---|---|---|
| `calificaciones/page.tsx` | 485 | 120 | `_hooks/useCalificaciones.ts` (401 líneas: todo el estado, `fetchData` y handlers) |
| `entregar/[assignmentId]/page.tsx` | 586 | 315 | `_components/{AssignmentHeader,WorkspaceZone,FileZone,ForumZone}.tsx` + `_services/fetchAssignment.tsx` (102 líneas: tipos + fetch) |
| `presentar/[examId]/page.tsx` | 816 | 256 | `_hooks/useExamSession.ts` (245 líneas: timer, respuestas, violaciones, autoguardado) + `_components/{ExamSplash,AnswerArea}.tsx` + `_services/fetchExamen.ts` + `_lib/examHelpers.ts` |

**`calificaciones/page.tsx` (485 líneas) — el más simple de los tres.**
Ya importa sus vistas desde `_components/` (`UnitsView`, `CaptureView`,
`FinalGradesView`, `SabanaView`, más los modales) — el archivo solo contiene
estado, `fetchData` y handlers (crear/editar unidad, actividad, criterios de
evaluación). División: extraer todo eso a
`_hooks/useCalificaciones.ts` (custom hook), dejando `page.tsx` como un
selector de vista de ~80-100 líneas que consume el hook. **Riesgo: bajo** —
patrón mecánico, no toca la lógica de negocio, solo la reubica.

**`entregar/[assignmentId]/page.tsx` (586 líneas).** Ya tiene sub-componentes
con nombre dentro del mismo archivo (`AssignmentHeader`, `WorkspaceZone`,
`FileZone`, `ForumZone`) más una función `fetchAssignment` y sus tipos.
División: cada sub-componente a su propio archivo en `_components/`, tipos +
`fetchAssignment` a `_services/fetchAssignment.ts`. Queda `EntregarContent` +
el `export default EntregarActividad` en `page.tsx`. **Riesgo: medio** — es
el flujo de entrega de tareas de un alumno; requiere probar el flujo
completo de envío después de dividir.

**`presentar/[examId]/page.tsx` (816 líneas) — el más delicado.** Es el
**motor de presentación de exámenes** de un alumno: temporizador, captura de
respuestas, detección de violaciones (salir de pantalla completa, cambiar de
pestaña), autoguardado. Ya tiene `ExamSplash` como sub-componente y
`fetchExamen` + helpers (`isAnswered`, `shuffle`, `formatTime`) separables.
División propuesta: `ExamSplash` → `_components/`; `fetchExamen` + tipos →
`_services/`; helpers puros → `_lib/examHelpers.ts`; el temporizador, estado
de respuestas, violaciones y autoguardado de `PresentarExamenContent` →
`_hooks/useExamSession.ts`, dejando en `page.tsx` solo el JSX que consume
ese hook. **Riesgo: alto** — es la pantalla donde un alumno está presentando
un examen en tiempo real; un error introducido aquí puede trabar un examen
a mitad de resolución o perder respuestas. Requiere pruebas manuales del
flujo completo (inicio de examen, respuesta de cada tipo de pregunta,
autoguardado, envío final, detección de violaciones) antes de considerarse
cerrado.

### 2.2 Ejecución y verificación

Confirmado por el usuario, se ejecutaron los 3 splits en el orden anterior
(menor a mayor riesgo). Cada extracción fue mecánica — mover código tal
cual a su nuevo archivo, sin reescribir lógica — para minimizar la
posibilidad de introducir un comportamiento distinto. Verificación después
de cada uno y al final del conjunto: `tsc --noEmit` limpio, `eslint` sin
regresiones (los mismos 9 problemas preexistentes de antes, ninguno nuevo),
`vitest` 3/3, y `npm run build` generando las 66 rutas sin error.

**Lo que no se pudo verificar en este entorno**: no hay staging con datos
reales ni navegador disponible aquí para hacer una corrida manual end-to-end
del examen (iniciar, responder cada tipo de pregunta, disparar el
autoguardado, forzar una violación de integridad, entregar). El split de
`presentar/[examId]` se mantuvo deliberadamente mecánico (mover código sin
tocar su lógica ni sus dependencias de `useEffect`/`useCallback`) para
reducir ese riesgo, pero la prueba manual en el navegador real sigue
pendiente y se recomienda antes de considerar esto cerrado del todo en
producción.

## 3. Restructuración de carpetas (Tarea 2)

Ver árbol completo en
[ARCHITECTURE_AND_DESIGN.md](../ARCHITECTURE_AND_DESIGN.md#3-árbol-de-directorios-objetivo).
Resumen: `components/` ya está correctamente separado por dominio (no
requiere cambios). La única separación que falta es dentro de las 3 rutas
de la sección 2.1 — extraer su lógica a `_hooks/`/`_services/` locales,
siguiendo el patrón `_components/` que el propio repo ya usa en
`calificaciones/`. No se crean carpetas globales `lib/hooks/`, `lib/services/`,
`lib/utils/` vacías sin contenido real — se documentan como destino
acordado para la primera vez que aparezca lógica compartida entre ≥2 rutas.

---

## 4. Estado de Módulo 01_B

| Tarea | Estado |
|---|---|
| 1. Extracción del sistema de diseño | ✅ Completa — [ARCHITECTURE_AND_DESIGN.md](../ARCHITECTURE_AND_DESIGN.md) §1 |
| 2. Reestructuración de carpetas | ✅ Ejecutada (patrón `_hooks/_services/_components/_lib` aplicado a las 3 rutas) |
| 3. Refactor con límites de línea | ✅ Ejecutado y verificado — 0 archivos por encima de 480 líneas en todo el repo. Pendiente: prueba manual end-to-end de `presentar/[examId]` en navegador real (ver §2.2 y §5) |
| 4. Mapa del árbol de directorios | ✅ Completo — [ARCHITECTURE_AND_DESIGN.md](../ARCHITECTURE_AND_DESIGN.md) §3 |
| 5. Archivo `ARCHITECTURE_AND_DESIGN.md` | ✅ Creado |
| Extra: bug real de `ImportModal` sin estilos | ✅ Corregido y verificado |
| Extra: normalización de colores hardcodeados | ✅ Ejecutado — ver §5.1 |
| Extra: roadmap de entorno de pruebas | ✅ Documentado — ver §5.2 |

## 5. Pasada de cierre (sesión posterior, re-auditoría del módulo)

Al retomar 01_B para cerrarlo se verificó primero que el trabajo de arriba
seguía vigente (no solo se confió en este documento): `wc -l` sobre el 100%
de `.ts`/`.tsx` de `app/`, `components/`, `lib/` — 0 archivos por encima de
480 líneas, el más grande es `investigacion/config/page.tsx` con 415/480.
`tsc --noEmit` limpio, `eslint` 0 errores (10 warnings preexistentes, no
bloqueantes), `vitest run` 13/13, `npm run build` genera las 66 rutas sin
error. Con eso confirmado, se ejecutaron dos cosas nuevas:

### 5.1 Normalización de colores hardcodeados (ejecutado)

La auditoría original (§1 del manual de diseño en
`ARCHITECTURE_AND_DESIGN.md`) había detectado la inconsistencia pero no la
había corregido. Se hizo un barrido real (`grep` de hex en todos los
`.module.css` de `app/` y `components/`) y se encontraron 5 archivos con
colores repetidos en vez de referenciar variables:

- **`app/page.module.css`** — era el boilerplate por defecto de Next.js
  (`#000`, `#fafafa`, etc.), **no lo importaba ningún archivo**
  (`app/page.tsx` solo hace `redirect("/inicio")`, sin estilos). Confirmado
  con el usuario y **eliminado** — código muerto, no normalización.
- **`app/alumno/components/AlumnoSidebar.module.css`**,
  **`app/alumno/materia/[id]/tablon.module.css`**,
  **`app/login/login.module.css`** — se reemplazó cada hex que coincidía
  **exactamente** con un valor de la paleta ya documentada por su variable
  (`var(--tecnm-blue)`, `var(--bg-surface)`, `var(--bg-app)`,
  `var(--border-light)`, etc.). Se agregaron a `app/globals.css` las
  variables semánticas y de superficie secundaria que faltaban para poder
  hacer esa sustitución sin inventar valores nuevos: `--color-success`,
  `--color-warning`, `--color-danger` (+ `-bg`/`-bg-soft`/`-dark`),
  `--color-info`, `--bg-surface-muted`, `--border-muted`, `--text-subtle`.
  Documentado en `ARCHITECTURE_AND_DESIGN.md` §1.2.
- Colores que **no calzaban exactamente** con ningún valor de paleta (ej.
  `#334155` en `tablon.module.css`, `#1e293b` en `login.module.css`) se
  dejaron **sin tocar a propósito** — normalizarlos habría significado
  inventar una variable nueva o cambiar el tono visual real, fuera del
  alcance de "normalizar duplicados", no de "rediseñar la paleta".
- Verificado con `tsc --noEmit` limpio y carga real de `/login` en
  navegador (Playwright vía Browser tool) sin errores de consola — la
  tarjeta, el botón y sus estados hover se ven idénticos al diseño
  original, solo cambió la fuente del valor (variable en vez de hex).

### 5.2 Intento de prueba E2E real del examen — bloqueada, documentada

Se intentó cerrar el único pendiente que dejó la sesión anterior (prueba
manual end-to-end de `presentar/[examId]`, ver §2.2) usando el Browser tool
disponible en esta sesión. Se encontraron **2 bloqueos reales de
infraestructura**, no de código:

1. `.env.local` tiene credenciales Supabase **placeholder** — no hay
   backend real conectado en este entorno.
2. El login de la app es **exclusivamente Google OAuth**
   ([lib/supabase.ts:22](../lib/supabase.ts)) — un agente no debe completar
   esa pantalla (requeriría escribir una contraseña real de terceros).

Se evaluó levantar un stack Supabase local (`supabase start`, ya hay
`config.toml` + migraciones reales en `supabase/`) pero **no hay Docker
instalado en esta máquina** (`docker: command not found`) — tercer bloqueo.

Se intentó una alternativa sin backend: un test automatizado (Vitest +
`jsdom` + `@testing-library/react`, recién agregados como devDependencies)
del hook `_hooks/useExamSession.ts` con `@/lib/supabase` mockeado —
cubriendo timer, bloqueo automático a la 3ra incidencia, y validación de
envío incompleto. **Se escribió y se revirtió**: `vitest.config.ts` no
tiene `resolve.alias` para `@/*` (solo `tsconfig.json` lo conoce), así que
Vitest no pudo resolver `@/lib/supabase` y la suite completa pasó de 3/3 a
1 fallida — se revirtió el test para no dejar `npm test` en rojo por un
problema de configuración no resuelto.

Los 4 bloqueos (backend real, login OAuth, Docker, alias en Vitest), cómo
desbloquear cada uno, y el roadmap completo de todo lo que falta testear en
el resto de la app (no solo el examen) quedaron documentados en
**[ENTORNO_DE_PRUEBAS.md](ENTORNO_DE_PRUEBAS.md)** — es un documento de
planificación, nada de esa sección 3 se ejecutó todavía.

## 6. Pendiente real (requiere acción humana)

## PENDIENTE (requiere acción humana)

- **Prueba E2E real de `presentar/[examId]`** y del resto del roadmap en
  `ENTORNO_DE_PRUEBAS.md` §3: requiere que el usuario cree un proyecto
  Supabase de prueba (gratuito) y decida entre compartir su URL/anon key
  (no sensibles) + configurar él mismo la `service_role key` en
  `.env.local` (sensible, no se pide en el chat), **o** instalar Docker
  Desktop para levantar el stack local con `supabase start`. Ninguna de las
  dos cosas puede decidirla ni ejecutarla un agente por su cuenta.
- **Arreglar `resolve.alias` en `vitest.config.ts`** — es una tarea de
  código pura (no requiere credenciales ni infraestructura), pero se dejó
  fuera de esta pasada porque el usuario pidió no ejecutar más cambios en
  esta conversación; queda como primer ítem accionable de
  `ENTORNO_DE_PRUEBAS.md` §2.
