# Para la próxima sesión (retomar domingo ~9am, cuando se restaure el límite semanal)

Resumen de todo lo que se construyó hoy y lo que queda pendiente. Nada de
esto se desplegó a producción — todo vive local, en `eui-reaserch-plataform-main/`,
esperando que tú decidas cuándo migrarlo (regla de esta sesión: solo SQL/código
listo, nunca `db push`/`functions deploy` corrido por mí).

## 🔴 Pendiente #1 — Fix de seguridad (ya documentado, sin tocar)

Ver **`PENDIENTE_FIXES_EDGE_FUNCTIONS.md`** (raíz de este mismo proyecto):
- `notify-exam-results` no valida dueño del examen (IDOR) — la corrección
  exacta ya está escrita ahí, copiada del patrón correcto que usa
  `publish-exam-form`.
- `invite-colaborador`: el envío de correo puede tumbar una operación que sí
  funcionó (baja prioridad).

## ✅ Construido y verificado hoy (161→174 tests, `tsc --noEmit` limpio) — sin desplegar

1. **Piloto `ai-tutor-sandbox`** (alumnos, 3 modos: assignment/exam_prep/general) —
   backend + frontend completos. Para activarlo en producción falta, del lado
   de infraestructura (no código):
   - Confirmar Upstash Redis configurado (`UPSTASH_REDIS_REST_URL`/`TOKEN`) —
     la función **falla cerrado** sin esto (a propósito, protege el presupuesto).
   - `AI_TUTOR_MAX_MESSAGES_PER_DAY` (default 40) y
     `AI_TUTOR_GLOBAL_MAX_MESSAGES_PER_DAY` (default 1200, **subir a ~2500**
     dado el crédito de AI Studio de $1000 USD/año que se acordó usar aquí).
   - Migración `20260909000000_ai_tutor_sandbox_pilot.sql` pendiente de aplicar.
   - Activar `ai_sandbox_*_enabled` en las 4-5 materias piloto (columnas en `courses`).

2. **Caso de estudio "GraphRAG casero vs. Vertex AI Search"** (crédito
   "Trial credit for GenAI App Builder", NO es el mismo API key de Gemini —
   ver conversación) — código listo (`vertex-search-query`, `run-rag-benchmark`,
   `_shared/googleServiceAccount.ts`), pero requiere trabajo tuyo en la
   consola de GCP que no pude hacer yo:
   - Habilitar Discovery Engine API / Vertex AI Agent Builder.
   - Crear Search App + data store por dominio (docencia/investigación).
   - Cuenta de servicio + secrets (`GCP_SERVICE_ACCOUNT_KEY_JSON`,
     `VERTEX_SEARCH_PROJECT_ID`, `VERTEX_SEARCH_LOCATION`,
     `VERTEX_SEARCH_ENGINE_ID_DOCENCIA`/`_INVESTIGACION`).
   - Correr manualmente `supabase/pendiente/002_graphrag_schema.sql` y poblar
     el grafo casero con `build-knowledge-graph` sobre los mismos documentos.

3. **K-Means — clústeres de riesgo académico** — completo, nueva pantalla
   `panel/materias/[id]/alumnos/riesgo`, ya en el Sidebar. Sin pendientes de
   infraestructura, solo falta desplegar `cluster-student-risk` +
   `_shared/kmeans.ts`.

4. **Isolation Forest — anomalías de examen** — completo
   (`detect-exam-anomalies`, columna nueva en resultados de examen). **Aviso
   real**: solo detecta algo en exámenes con entregas posteriores a hoy (el
   campo `answer_timing` se agregó hoy en `useExamSession.ts`) — entregas
   viejas se excluyen siempre, nunca se fabrica el dato.

5. **Regresión Logística — Validador independiente de integridad** —
   completo (`validate-submission-integrity`, `submit-integrity-feedback`,
   tabla `integrity_flag_feedback`, botones de feedback en la pantalla de
   auditoría). Pesos fijados a mano (arranque en frío); `fitWeights()` ya
   existe para cuando se acumule feedback real de docentes.

## 📋 Housekeeping de la sesión (contexto, no acción pendiente)

- Se restauró `_shared/auth.ts` y `_shared/gemini.ts` dos veces después de
  que `supabase functions download` los sobrescribiera con versiones viejas
  de producción — **si vuelves a correr `functions download` de cualquier
  función, revisa `_shared/*.ts` después** (no hay git en este repo para
  diffear fácil).
- Se recuperaron 12 Edge Functions que existían en producción pero no en
  este repo local (`confirm-invitacion`, `invite-colaborador`,
  `canvas-copilot`, `import-ia-teams`, `extract-exam-questions-ia`,
  `retry-pending-deliveries`, `notify-exam-results`, `update-assignment-hub`,
  `publish-exam-form`, `ingest-form-response`, `enforce-assignment-deadlines`,
  `activate-scheduled-exams`) + `analyze-submission-integrity`. Todas
  auditadas, solo el hallazgo de seguridad de arriba quedó pendiente.
- Se reparó el historial de migraciones (`supabase migration repair`) para
  3 migraciones que estaban aplicadas en producción sin archivo local
  (`20260628181636`, `20260628182200`, `20260701000000`) — quedaron como
  placeholders vacíos documentados, contenido real desconocido.
- `node_modules` se reinstaló (se había perdido al cambiar de computadora) —
  ya puedes correr `npm run dev`, `npx tsc --noEmit`, `npx vitest run`
  localmente sin pedírmelo.
- Módulo `(investigacion)` completo (estaba ausente de esta copia local) se
  recuperó del zip de GitHub al inicio de la sesión.
- Reestructura de rutas: `(campo)`, `(investigacion)`, `(laboratorio)` se
  fusionaron dentro de `(docente)` (mismo rol, distinto `access_level`);
  `alumno` se movió a `(alumno)/alumno` — todo verificado sin romper imports.

## Primera pregunta sugerida para retomar

"¿Empezamos por el fix de seguridad de `notify-exam-results`, o por dejar
listo el piloto de alumnos para encenderlo (Upstash + migración +
interruptores por materia)?"
