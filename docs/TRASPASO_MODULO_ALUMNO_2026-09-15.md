# Traspaso de sesión — Cierre de Docente, arranque de Módulo Alumno

**Fecha de cierre:** 2026-09-15
**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**GitHub:** `jacandelerocervantes-cmd/eui-reaserch-plataform`, rama `main` — sincronizado (force push del 2026-09-14, push normal después).

---

## Estado del módulo Docente: NO 100% cerrado, pero sí estable — gaps conocidos y documentados abajo

Todo lo crítico reportado por el docente en producción está resuelto y verificado (código real + BD real, no solo `tsc`/`build`). Quedan 5 puntos explícitamente diferidos, no accidentales — decidir si se atacan después o quedan en backlog:

1. **Rediseño grande de Unidades/Calificaciones sin ejecutar**: `docs/INSTRUCCION_ANTIGRAVITY_UNIDADES_CALIFICACIONES_2026-09-14.md` — separar `course_units.is_closed` en `attendance_closed_at`/`grades_closed_at` (para que "Sellar asistencia" y "Cerrar Unidad" de notas dejen de ser la misma acción confusa), y ponderación individual por examen (`exams.weight_data`, mismo patrón que ya tienen las tareas). Redactada, nunca enviada a ejecutar — quedó pospuesta por los fixes más urgentes que fueron apareciendo.
2. **Duplicar Actividad dispara correo real a alumnos de la materia destino** — comportamiento confirmado (ver `DuplicateActivityModal.tsx` → `create-assignment-hub`), pero el usuario nunca decidió si debe cambiar. Sin decisión tomada, sin tocar.
3. **Bug del Sidebar (recién arreglado, commit `d3874fb`)** — solo se corrigió donde se detectó (pantalla Unidades). No se auditó sistemáticamente si otros botones "a la izquierda" (x aprox. 80-280px) en otras pantallas del docente también caen en esa franja muerta del sidebar. Probablemente no, pero no descartado al 100%.
4. **Deploy de Vercel pendiente de confirmar** — el usuario debía correr `npx vercel@59.1.4 deploy --prod --scope jacandelerocervantes-cmds-projects` después del último commit (`d3874fb`, fix del sidebar). Confirmar al arrancar la siguiente sesión que producción ya refleja esto antes de asumir que el bug de Unidad 1 está resuelto en vivo.
5. **Rotar credenciales recomendado, no confirmado**: `Supabase Secret Key` y `GCP API Key` estuvieron en el primer commit local (`env.local`, nunca llegó a publicarse — GitHub lo bloqueó, se limpió del historial). Bajo riesgo real, pero pendiente confirmar si ya se rotaron por precaución.

### Hallazgos de compliance/legal — fuera del alcance de código, requieren decisión institucional (no son bugs a arreglar)
- Aviso de privacidad institucional del TecNM: ¿cubre la transferencia de nombre + contenido de entregas a Google Gemini? No verificable desde el código.
- Sin política de retención/borrado de datos de alumnos dados de baja — dato persiste indefinidamente.
- Sin mecanismos ARCO (acceso/rectificación/cancelación/oposición) formales.

---

## Resumen de lo que SÍ quedó cerrado y verificado esta sesión (2026-09-14 a 2026-09-15)

- **18 archivos** con el bug sistémico de clics rotos (`use()`/Suspense → `useEffect`+`useState`) — corregidos y desplegados.
- **Chat de creación con IA** en Actividades y Evaluaciones (exámenes), con "ajustar en vez de regenerar", desplegado.
- **5 IDOR + 1 fuga crítica de RLS** (`assignments`/`course_units` legibles por `anon` sin sesión) — corregidos y verificados en vivo contra `pg_policies`.
- **Comentarios por publicación en Tablón** (moderación individual, reemplaza el switch global) — desplegado.
- **Módulos Campo/Laboratorio/Investigación eliminados** por completo: 46 archivos de frontend, 12 Edge Functions (código Y Supabase, no solo código), 8 tablas de BD (0 filas reales, sin pérdida de datos).
- **Auditoría de 9 personas** (security/dba/backend/qa/code-reviewer/solutions-architect/sre/compliance/ml-engineer, del framework `stack-ia-dev/stack/propio/agents`) sobre `app/(docente)/**`, con hallazgos verificados (no solo reportados) y la mayoría corregidos: columnas faltantes en `submissions`, errores de guardado silenciosos, guardrails de IA faltantes, N+1, índices, código muerto, idempotencia de notificaciones/Google Forms, rate limiting, etiqueta de riesgo académico engañosa, deduplicación de código (`formatStudentName`, `sumWeights`).
- **Bug de Unidad 1** (error Postgres `23502`) — causa raíz real diagnosticada (PostgREST + arrays mixtos en `upsert`), corregida con backfill + fix de código.
- **Badge duplicado** "Unidad 1: Unidad 1" en Calificaciones — corregido.
- **Duplicar Examen a otra materia** (Copiar 1:1) — construido desde cero, sin el riesgo de notificación accidental que sí tiene Actividades (guardar examen no pasa por ninguna Edge Function con efectos secundarios).
- **Bug del Sidebar interceptando clics** — encontrado y corregido en vivo (ver punto 3 arriba sobre alcance de la verificación).
- Repo git inicializado, sincronizado a GitHub, con identidad de commit correcta (`jacandelerocervantes-cmd <ja.candelerocervantes@gmail.com>`, configurada solo local a este repo).

---

## Metodología que funcionó bien esta sesión (repetir en la de Alumno)

1. **Yo (Claude) no edito código directamente** — preparo instrucciones detalladas con rutas exactas en `docs/INSTRUCCION_ANTIGRAVITY_*.md`, el usuario se las pasa a Antigravity.
2. **Antigravity ejecuta y reporta** — plan de implementación primero (lo reviso antes de autorizar ejecución), luego ejecución + reporte de archivos tocados.
3. **Yo audito el resultado real** — no confío en el resumen, reviso el código/diff real, corro `tsc`/`build` de forma independiente, y cuando aplica, verifico contra la base de datos real (`npx supabase db query --linked`) en vez de asumir.
4. **Cuando algo no cuadra con lo reportado por el usuario en producción, reproducir en vivo** (Chrome real vía `claude-in-chrome`) en vez de solo leer código — así se encontró el bug real del Sidebar hoy, que no tenía nada que ver con la hipótesis inicial de datos/React.
5. **Deploys de Supabase (migraciones + Edge Functions) los corro yo directamente** con confirmación previa del usuario. **El deploy de Vercel lo corre el usuario en su propia terminal** — la CLI de Vercel tuvo problemas de autenticación cruzada con otra cuenta de Google cuando se intentó automatizar.
6. **Todo se comitea a git localmente con identidad correcta**, se hace push normal a GitHub (ya no hace falta force, el repo local es ahora la base real).

---

## Arranque de la siguiente sesión: Módulo Alumno

Bug ya identificado y documentado, pendiente de atacar como primer punto (ver `docs/PLAN_ACTIVIDADES_EVALUACIONES_2026-09-14.md` sección "TRASPASO PARA SESIÓN SIGUIENTE" del 2026-09-14, aún vigente):

**Mismo bug sistémico de clics rotos (`use()`/Suspense) en 8 archivos de `app/(alumno)/**`, nunca auditado esta sesión** (la auditoría de los 18 fue solo del lado docente):
- `app/(alumno)/alumno/invitacion/page.tsx` — **este archivo ya no existe**, se borró junto con el módulo de Investigación (el flujo de invitación a colaborar en proyectos de investigación ya no aplica). Quitar de la lista.
- `app/(alumno)/alumno/materia/[id]/actividades/page.tsx`
- `app/(alumno)/alumno/materia/[id]/asistencia/page.tsx`
- `app/(alumno)/alumno/materia/[id]/calificaciones/page.tsx`
- `app/(alumno)/alumno/materia/[id]/evaluaciones/page.tsx`
- `app/(alumno)/alumno/materia/[id]/material/page.tsx`
- `app/(alumno)/alumno/materia/[id]/entregar/[assignmentId]/page.tsx` — **crítico**: entregar una actividad.
- `app/(alumno)/alumno/materia/[id]/presentar/[examId]/page.tsx` — **crítico**: presentar un examen.

Nota: `app/(alumno)/alumno/materia/[id]/page.tsx` (Tablón del alumno) **ya se corrigió** esta sesión (parte del trabajo de comentarios en Tablón) — no repetirlo.

**Sugerencia de arranque para la sesión de Alumno**, siguiendo el mismo orden que funcionó en Docente:
1. Auditar los 7 archivos restantes (mismo patrón que la auditoría de los 18 de docente) para confirmar cuáles tienen controles clicables reales antes de asumir severidad — los 2 marcados "crítico" (entregar actividad, presentar examen) son los que de verdad bloquean el flujo académico si fallan.
2. Aplicar el mismo fix mecánico ya usado 18+ veces (`useEffect`+`useState`, plantilla: `useEditarActividad.ts` o `actividades/[assignmentId]/page.tsx` del lado docente).
3. Después de ese fix, considerar correr la misma auditoría de 9 personas que se hizo en Docente, pero para `app/(alumno)/**` — dado que rindió bien esta sesión, sacando a la luz cosas que ni el usuario ni el código dejaban ver a simple vista (la fuga de RLS crítica, el bug real del Sidebar, etc.).

---

## Reglas operativas (sin cambios, siguen aplicando)

- Cualquier escritura a producción (deploy, migración) requiere confirmación explícita del usuario antes de ejecutar.
- Login/consentimiento de Google lo hace el usuario, nunca el agente — la CLI de Vercel específicamente tuvo un incidente de autenticación cruzada esta sesión, por eso el deploy de Vercel quedó como responsabilidad del usuario.
- Materia de prueba: "QA Red Team - Materia Prueba" (`ba00005d-e964-4d02-806b-62f2163baa8f`) — para el módulo Docente. Para Alumno, usar la materia `3f8ec239-1b0a-45a9-9478-7d964d59aa7f` (la usada para reproducir el bug del Sidebar hoy) o confirmar con el usuario cuál conviene usar para probar como alumno.
