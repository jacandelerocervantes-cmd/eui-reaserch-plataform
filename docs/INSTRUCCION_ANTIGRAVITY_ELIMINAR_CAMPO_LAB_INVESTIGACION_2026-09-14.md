# Instrucción para Antigravity — Eliminar módulos Campo, Laboratorio e Investigación (solo código)

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Estado:** hay un punto de restauración local en git (commit `eaa8ce4`, recién creado esta sesión) antes de esta operación — si algo sale mal, es recuperable con `git checkout eaa8ce4 -- <archivo>` o similar. Aun así, proceder con cuidado quirúrgico.

## Decisiones confirmadas por el usuario (no reabrir)

1. Se elimina también el flujo de invitación de alumno a proyectos de investigación (`app/(alumno)/alumno/invitacion/page.tsx` + Edge Functions `invite-colaborador`/`confirm-invitacion`).
2. **Solo se borra código/frontend/Edge Functions en esta tarea — las tablas de base de datos NO se tocan** (quedan intactas con sus datos, decisión de eliminarlas queda para otra tarea aparte).
3. Alcance: `app/(docente)/campo/**`, `app/(docente)/laboratorio/**`, `app/(docente)/investigacion/**` completos.

Al terminar, reporta: lista completa de archivos/carpetas eliminados, archivos modificados (con qué se quitó de cada uno), Edge Functions eliminadas, resultado de `npx tsc --noEmit` + `npm run build`.

---

## 1. Eliminar carpetas completas (46 archivos, confirmado por auditoría de esta sesión)

- `app/(docente)/campo/` (10 archivos: `layout.tsx`, `page.tsx`, `_hooks/useCampo.ts`, `_components/NuevaMisionModal.tsx`, `_components/types.ts`, `captura/page.tsx`, `captura/_hooks/useCaptura.ts`, `misiones/[id]/page.tsx`, `misiones/[id]/_hooks/useMisionDetalle.ts`, `sincronizar/page.tsx`)
- `app/(docente)/laboratorio/` (11 archivos: `layout.tsx`, `page.tsx`, `_hooks/useLaboratorio.ts`, `bitacora/page.tsx`, `bitacora/_hooks/useBitacoraLaboratorio.ts`, `equipo/page.tsx`, `equipo/_hooks/useEquipoLaboratorio.ts`, `sensores/page.tsx`, `sensores/_hooks/useSensoresIoT.ts`, `sensores/_components/IotCopilotPanel.tsx`, `sensores/_components/MiniMarkdown.tsx`)
- `app/(docente)/investigacion/` (25 archivos — carpeta completa: `layout.tsx`, `page.tsx`, `_hooks/`, `_components/`, `config/`, `canvas/`, `literatura/`, `radar/`, `financiamiento/`, `tesis/`, `proyectos/`)
- `app/(alumno)/alumno/invitacion/page.tsx` (decisión 1 confirmada)

## 2. Eliminar Edge Functions

Eliminar las carpetas completas (`supabase/functions/<nombre>/`):
- `analyze-capture`
- `confirm-capture`
- `iot-copilot`
- `search-literature`
- `import-doi-metadata`
- `analyze-literature-gaps`
- `generate-financial-report`
- `generate-tesis-feedback`
- `invite-colaborador`
- `confirm-invitacion`
- `compute-research-trends`

**NO eliminar** (confirmado como compartidas con el núcleo de docencia — auditoría de esta sesión):
- `_shared/kalman.ts`, `_shared/kalmanStore.ts` — usadas también por `compute-student-risk-signals` (riesgo académico de Alumnos, núcleo).
- `build-knowledge-graph`, `graphrag-query` — funciones parametrizadas por `domain` (`"docencia"` vs `"investigacion"`). Editarlas para **quitar solo la rama/caso `domain === "investigacion"`** (revisar `index.ts` de cada una, líneas donde se referencian `knowledge_nodes_investigacion`/`knowledge_edges_investigacion`), dejando intacta la rama `"docencia"`. No borrar la función completa.

## 3. Limpiar navegación y acoplamiento fuera de los 3 módulos

- **`components/layout/Sidebar.tsx`**: quitar las 3 entradas del array `modules` que agregan "Investigación" (líneas ~68), "Laboratorio" (~71), "Campo" (~72), y los imports de íconos `Telescope`, `TestTubeDiagonal`, `Map` si quedan sin uso tras quitarlas. También revisar `getScopeFromPath()` (líneas ~25-31) — quitar los 3 mapeos de path que ya no aplican.
- **`app/(docente)/panel/materias/[id]/crear-ia/page.tsx`** (líneas ~12-16, dentro del núcleo de docencia — tocar con cuidado, es el único archivo de este núcleo que se edita en esta tarea): quitar las opciones "Investigación"/"Laboratorio"/"Campo" del selector de scope del "Copiloto de Creación", dejando solo "Docencia".
- **`components/ia/FloatingCopilot.tsx`** (líneas ~18-33): quitar las entradas `INVESTIGACION`/`LABORATORIO`/`CAMPO` de `SCOPE_COLORS`/`QUICK_ACTIONS` si quedan huérfanas tras los cambios anteriores (revisar si algo más las consume antes de borrar).
- **`supabase/functions/_shared/copilotTools.ts`**: confirmar que no queda ningún tool con `scopes` referenciando estos 3 dominios (la auditoría encontró que hoy todos los tools ya son `scopes: ["DOCENCIA"]`, así que probablemente no haga falta cambiar nada aquí — solo confirmar).

## 4. Funciones "fantasma" — no crearlas, no es parte de esta tarea

La auditoría encontró que Campo/Laboratorio ya invocan 5 nombres de Edge Function que NO EXISTEN en el repo (`sync-field-captures`, `generate-field-report`, `ingest-telemetry`, `extract-eln-entities`, `update-equipment-status`) — es decir, esas partes ya estaban rotas antes de esta tarea. Como se borra el código que las invoca, este problema desaparece junto con el resto — no hace falta ninguna acción adicional sobre ellas.

## 5. Tablas de base de datos — NO TOCAR en esta tarea

Confirmado por decisión del usuario: no generar ninguna migración `DROP TABLE` en esta tarea. Las siguientes tablas quedan intactas, sin código que las consuma desde el frontend, para una decisión posterior:
`misiones_campo`, `capturas_campo`, `equipos_lab`, `equipos_lab_logs`, `telemetria_iot`, `entradas_bitacora`/`bitacora_eln`, `proyectos_investigacion`, `literatura_referencias`, `fondos_investigacion`, `tesistas`, `canvas_documentos`, `proyecto_colaboradores`.

## 6. Reglas de esta sesión (aplican igual)

- No hacer deploy ni ejecutar `supabase functions delete` contra producción — el usuario autoriza el deploy/limpieza de producción aparte, después de revisar el resultado local.
- No tocar nada más del núcleo de docencia (`panel/materias/**`) salvo lo explícitamente listado en la sección 3.
- Si al hacer `npm run build` aparece algún import roto hacia archivos ya eliminados que esta lista no haya anticipado, arreglarlo (quitar el import/referencia), pero reportarlo explícitamente — no debería expandirse el alcance más allá de "dejar de referenciar lo eliminado".
