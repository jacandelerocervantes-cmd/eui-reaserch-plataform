# Instrucción para Antigravity — Limpieza de paleta / alert() / StatCard en Evaluaciones

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Objetivo:** último pendiente de limpieza del módulo Evaluaciones (exámenes), ya con el chat de IA y el fix de clics rotos cerrados esta sesión. Es limpieza visual/consistencia, no funcionalidad nueva — cambios quirúrgicos, sin refactors de más.

Al terminar, reporta: archivos modificados (ruta relativa completa), resultado de `npx tsc --noEmit` + `npm run build`.

---

## 0. Antes de nada: borrar archivo muerto

[`app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/AIPromptBar.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/AIPromptBar.tsx) ya no se usa — fue reemplazado por `ExamChatAssistant.tsx` esta sesión y quedó huérfano (confirmado: no aparece importado en `nuevo/page.tsx`). **Eliminarlo.** No hace falta arreglar su paleta, se borra.

## 1. Paleta — reemplazar azul genérico `#2563eb`/`#eff6ff`/`#f0f7ff` por navy `#1B396A`

Confirmado por grep (esta sesión), 8 archivos con ocurrencias reales (fuera del ya eliminado `AIPromptBar.tsx`):

1. [`evaluaciones/nuevo/_components/SimulacionModal.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/SimulacionModal.tsx) — líneas 62, 121, 250, 270, 576, 605 (`#eff6ff` como fondo de estado seleccionado/activo).
2. [`evaluaciones/page.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/page.tsx) — línea 15, objeto de color por status: `published: { text: "#2563eb", bg: "#eff6ff" }`.
3. [`evaluaciones/[examId]/configuracion/page.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/configuracion/page.tsx) — líneas 37, 88.
4. [`evaluaciones/[examId]/page.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/page.tsx) — línea 107 (badge `#f0f7ff`/`#2563eb`).
5. [`evaluaciones/[examId]/resultados/page.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/resultados/page.tsx) — líneas 240, 247.
6. [`evaluaciones/[examId]/simulacion/page.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/simulacion/page.tsx) — líneas 187, 194, 199.
7. [`evaluaciones/_components/AudienceSelector.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/_components/AudienceSelector.tsx) — línea 29 (`#eff6ff` fondo de fila seleccionada).

**Regla de reemplazo:** `#2563eb` → `#1B396A` (texto/ícono). Para fondos claros tipo `#eff6ff`/`#f0f7ff` (tinte muy claro del azul genérico), usar el mismo patrón que ya usa el resto del proyecto para tintes navy claros: `#1B396A15` o `#1B396A10` (hex + alpha de 2 dígitos, ver `StatCard` en el punto 3 de este documento como ejemplo exacto de esa técnica) en vez de un hex fijo nuevo — mantiene consistencia con cómo se generan tintes claros en el resto del código. Si algún caso puntual no calza bien visualmente con alpha (por ejemplo, fondos muy grandes que se ven demasiado oscuros), usar criterio y dejar nota en el reporte final, pero por defecto usar `#1B396A` + alpha.

**No tocar** los colores de otros estados que ya son intencionalmente distintos (ej. `#10b981` verde para "Aprobados", `#f59e0b` ámbar para "Por Calificar", `#7c3aed` morado para exámenes en el feed) — el problema es específicamente el azul genérico `#2563eb`, no la paleta completa.

## 2. `alert()`/`confirm()` nativos — reemplazar por el patrón toast ya establecido

Reemplazar TODOS por el patrón `feedback: { type: 'success' | 'error', message: string } | null` con auto-dismiss a 4 segundos, toast fijo esquina superior derecha (`position: fixed`) — mismo patrón usado en `useNuevaActividad.ts` y en `useTablon.ts` esta sesión. Confirmado por grep, conteo exacto:

1. [`evaluaciones/[examId]/configuracion/_hooks/useConfiguracionExamen.ts`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/configuracion/_hooks/useConfiguracionExamen.ts) — 12 `alert()`.
2. [`evaluaciones/[examId]/_hooks/useEvaluacionDetalle.ts`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/_hooks/useEvaluacionDetalle.ts) — 6 `alert()` + 1 `confirm()`.
3. [`evaluaciones/[examId]/resultados/page.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/resultados/page.tsx) — 2 `alert()`.
4. [`evaluaciones/[examId]/revision/[studentId]/_hooks/useRevisionExamen.ts`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/revision/[studentId]/_hooks/useRevisionExamen.ts) — 2 `alert()`.
5. [`evaluaciones/_hooks/useEvaluaciones.ts`](../app/(docente)/panel/materias/[id]/evaluaciones/_hooks/useEvaluaciones.ts) — 1 `alert()`.

Total: 23 `alert()` + 1 `confirm()`.

**El `confirm()`** (en `useEvaluacionDetalle.ts`) es distinto a un `alert()` informativo — probablemente protege una acción destructiva/irreversible (revisar el contexto exacto en el archivo). No reemplazarlo por un toast simple: usar un modal de confirmación propio (¿ya existe alguno reusable en el proyecto? buscar antes de crear uno nuevo) o, como mínimo, un patrón de "doble clic"/confirmación inline — no degradar la protección que ese `confirm()` estaba dando. Señalar en el reporte qué se decidió.

Cada archivo/hook necesita su propio estado `feedback` local (no hay un hook global de toasts en el proyecto) — seguir el patrón ya usado, no inventar uno nuevo.

## 3. `StatCard` duplicado — unificar en un componente compartido

Dos implementaciones con fórmula de color distinta:
- [`app/(docente)/panel/materias/[id]/actividades/[assignmentId]/_components/StatCard.tsx`](../app/(docente)/panel/materias/[id]/actividades/[assignmentId]/_components/StatCard.tsx) — `padding: 24px`, `borderRadius: 24px`, ícono en caja `borderRadius: 16px`, tinte de color `${color}15`, `value: number` (tipo estricto).
- [`app/(docente)/panel/materias/[id]/evaluaciones/[examId]/resultados/page.tsx:362-372`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/resultados/page.tsx) — componente local no exportado, `padding: 25px`, `borderRadius: 20px`, ícono en caja `borderRadius: 12px`, tinte `${color}10`, `value: string | number`.

**Fix:**
1. Crear `components/ui/StatCard.tsx` (ubicación compartida, sigue la convención de `components/ui/DateTimeFieldMX.tsx` y `components/ui/ExpandingButton.tsx` ya existentes) basado en la versión de `actividades/[assignmentId]/_components/StatCard.tsx` (es la más consistente con el resto del sistema de diseño: `borderRadius: 24px`/`16px`, tinte `15`). Usar el tipo `value: string | number` (más flexible, cubre ambos casos reales).
2. Actualizar `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/page.tsx` para importar desde la nueva ubicación compartida en vez de `./_components/StatCard` — **este es el único cambio permitido en `app/(docente)/panel/materias/[id]/actividades/**` en esta tarea, es un cambio de import de una línea, sin tocar comportamiento.** Señalarlo explícitamente en el reporte.
3. Eliminar el archivo viejo `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/_components/StatCard.tsx` una vez migrado el import (o dejarlo como re-export si prefieres menor riesgo — usar criterio, señalar la decisión).
4. En `evaluaciones/[examId]/resultados/page.tsx`: quitar el componente local (líneas 362-372) e importar `StatCard` desde `components/ui/StatCard.tsx`.
5. Revisar si hay más usos de `StatCard` en el proyecto (buscar con grep antes de dar por cerrado) que también deberían apuntar al componente compartido — si aparecen más, listarlos en el reporte, no hace falta migrarlos todos en esta tarea si el alcance crece demasiado, usar criterio.

## 4. Reglas de esta sesión (aplican igual)

- No hacer deploy — el usuario autoriza después.
- No usar `use(resource)`/Suspense en ningún cambio.
- Cambios quirúrgicos: esto es limpieza de consistencia visual y deuda técnica ya señalada, no una oportunidad para refactorizar de más.
