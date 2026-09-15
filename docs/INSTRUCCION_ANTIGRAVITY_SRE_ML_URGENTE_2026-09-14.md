# Instrucción para Antigravity — Idempotencia, rate limiting y etiqueta de riesgo (más urgente de la 2ª tanda)

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Origen:** auditoría con lentes SRE y ML de esta sesión (9 personas de `stack-ia-dev/stack/propio/agents` en total ya corrieron sobre el módulo docente). Esta es la primera de dos instrucciones — los hallazgos de menor urgencia (duplicación de código, arquitectura, compliance/legal) van en una segunda instrucción aparte.

Al terminar, reporta: archivos nuevos/modificados (ruta completa), migración(es) SQL, resultado de `npx tsc --noEmit` + `npm run build`.

---

## 1. 🔴 `notify-exam-results` sin idempotencia — doble clic/reintento duplica el correo de resultados a toda la clase

`supabase/functions/notify-exam-results/index.ts`: cada invocación reconstruye y reenvía el correo a todos los alumnos con calificación, sin chequear si ya se notificó antes. El único freno hoy es un flag de React (`isNotifying` en `app/(docente)/panel/materias/[id]/evaluaciones/[examId]/_hooks/useEvaluacionDetalle.ts:180-190`) que no sobrevive un remount/recarga — no es protección real contra doble envío.

**Fix:**
1. Migración nueva: `supabase/migrations/20260914120000_exam_results_notification_state.sql`
   ```sql
   alter table public.exams add column if not exists results_notified_at timestamptz;
   ```
2. En `notify-exam-results/index.ts`: antes de enviar, leer `exams.results_notified_at`. Si ya tiene valor, no reenviar automáticamente — devolver `{success: false, already_notified: true, notified_at: ...}` con status 409. Tras un envío exitoso, hacer `update({results_notified_at: new Date().toISOString()})` sobre el examen.
3. En `useEvaluacionDetalle.ts` (donde se invoca esta función): si la respuesta trae `already_notified: true`, mostrar un modal de confirmación explícito ("Ya se notificaron resultados el [fecha]. ¿Reenviar de todas formas?") en vez de bloquear silenciosamente o reenviar sin avisar — un docente legítimamente podría necesitar reenviar tras corregir una nota, pero debe ser una decisión consciente, no accidental. Si el docente confirma el reenvío, pasar un flag `force: true` en el body que la Edge Function respete para saltarse el chequeo.

## 2. 🔴 `publish-exam-form` crea un Google Form nuevo cada vez — pérdida silenciosa de respuestas si ya existía uno

`supabase/functions/publish-exam-form/index.ts:~88-110`: no verifica `exams.deployment_method`/`exams.google_form_id` (columnas ya existentes en el esquema real, confirmadas) antes de llamar `crearFormularioGoogle` y sobrescribir esos campos. El Form anterior queda huérfano en Drive, y si ya tenía respuestas de alumnos, se pierden de la vista de la plataforma.

**Fix:** al inicio de la función, si `exams.google_form_id` ya tiene valor, no crear un Form nuevo por defecto — devolver `{success: false, already_published: true, google_form_url: <el existente>}` con status 409. Aceptar un flag `force: true` en el body para permitir explícitamente recrear el Form (mismo patrón que el punto 1), y solo entonces proceder, dejando registrado en el log que se reemplazó un Form existente (incluir el `google_form_id` viejo en el log antes de sobrescribirlo, para poder rastrearlo manualmente en Drive si hace falta). En el frontend correspondiente (buscar dónde se invoca `publish-exam-form`, probablemente `useConfiguracionExamen.ts` o similar), mostrar el mismo tipo de confirmación explícita que en el punto 1 si la respuesta trae `already_published: true`.

## 3. 🔴 Rate limiting de IA implementado pero no aplicado donde más importa

`checkRateLimit()` ya existe en `supabase/functions/_shared/cache.ts` y ya se usa en `ai-tutor-sandbox` y `bulk-evaluate-exams` — úsalos como plantilla exacta de cómo se invoca. Agregar la misma llamada (mismo patrón: verificar antes de la llamada a Gemini, devolver 429 si excede el límite) a estas 8 Edge Functions del docente que hoy no lo tienen:

- `supabase/functions/generate-exam-ia/index.ts`
- `supabase/functions/generate-rubric-ia/index.ts`
- `supabase/functions/extract-exam-questions-ia/index.ts`
- `supabase/functions/evaluate-submissions-ia/index.ts`
- `supabase/functions/detect-cross-plagiarism/index.ts`
- `supabase/functions/analyze-exam-group-results/index.ts`
- `supabase/functions/detect-exam-anomalies/index.ts`
- `supabase/functions/compute-student-risk-signals/index.ts`

Usar como clave de rate limit el `userId` del docente autenticado (mismo criterio que las 2 funciones que ya lo implementan). Revisar qué ventana/límite usan `ai-tutor-sandbox`/`bulk-evaluate-exams` y aplicar un límite del mismo orden de magnitud (razonable para uso normal de un docente, no artificialmente bajo) — usar criterio, señalar en el reporte final los valores exactos elegidos por función si difieren entre ellas.

## 4. 🟡 `sync-grading-matrix` no chequea si Apps Script realmente tuvo éxito

`supabase/functions/sync-grading-matrix/index.ts:~85,95-98`: hace `scriptResult = await response.json()` y responde `{success:true, ...}` sin verificar `scriptResult.success`. A diferencia de `publish-exam-form`/`notify-exam-results`/`retry-pending-deliveries`, que sí hacen ese chequeo — usar esas como plantilla. Si `scriptResult.success` es `false` o el campo no viene, devolver `{success:false, error: scriptResult.error ?? "Error de sincronización"}` en vez de reportar éxito falso al docente.

## 5. 🟡 Etiqueta de "perfil de riesgo" es relativa al curso, pero se presenta como si fuera absoluta

Confirmado: `compute-student-risk-signals` ya calcula `motivo_riesgo`/`en_riesgo` (umbral absoluto, ej. asistencia < 60%) y lo transporta hasta el frontend (`app/(docente)/panel/materias/[id]/alumnos/riesgo/_services/fetchRiesgo.ts`), pero la pantalla (`app/(docente)/panel/materias/[id]/alumnos/riesgo/page.tsx` + `_hooks/useRiesgoAcademico.ts`) solo muestra la etiqueta de clúster de K-Means, que es relativa al promedio de ESE curso, no un umbral absoluto — un alumno con buena asistencia real puede aparecer en el grupo "Riesgo" solo por estar bajo el promedio de un curso con asistencia muy alta.

**Fix (no cambiar el algoritmo de clustering, solo exponer el dato que ya existe):**
1. En `riesgo/page.tsx`, dentro de cada tarjeta de alumno, mostrar el campo `motivo_riesgo` (texto ya generado por el backend) junto a la etiqueta del clúster.
2. Agregar una nota visible y breve en la UI (ej. tooltip o texto pequeño bajo el título del grupo) aclarando que la agrupación es relativa al desempeño de este curso específico, no un umbral absoluto — para que el docente interprete correctamente por qué un alumno con números que parecen "normales" puede aparecer en un grupo de riesgo.

## Reglas de esta sesión (aplican igual)

- No hacer deploy ni `supabase db push` — el usuario autoriza después.
- `useEffect`+`useState` siempre, nunca `use()`/Suspense.
- Sin `alert()`/`confirm()` nativos nuevos — usar el patrón `feedback`/modal ya establecido para las confirmaciones de "ya se notificó"/"ya se publicó" de los puntos 1 y 2.
- Cambios quirúrgicos — no toques nada fuera de los 5 puntos listados.
