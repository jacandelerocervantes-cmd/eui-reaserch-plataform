# Pendiente — pasos manuales para desplegar lo construido esta sesión

Todo el código ya está escrito, tipado (`deno check`) y linteado (`deno lint`) limpio. Lo único que falta es esto: correrlo tú en tu proyecto real de Supabase, en este orden.

## 0. Prerrequisito — CLI conectada a tu proyecto

Si no lo tienes ya hecho en esta máquina:

```bash
supabase login
supabase link --project-ref <tu-project-ref>   # lo ves en Dashboard → Project Settings → General
```

## 1. Base de datos — correr los 7 SQL en orden

En el **SQL Editor de Supabase** (Dashboard → tu proyecto → SQL Editor), pega y ejecuta cada archivo completo. **Ver `ORDEN_SQL.md` en este mismo folder para el orden exacto y por qué** (resumen: no hay dependencias de esquema entre ellos salvo la del punto 6, el orden es por riesgo — primero el que transforma datos existentes, después el que arregla un bug activo, al final los puramente aditivos):

1. `001_fix_literatura_referencias_columns.sql` — renombra columnas de `literatura_referencias` a inglés (`created_at`, `url`) y convierte `autores` a array. **Antes de correrlo**: si esa tabla ya tiene filas reales, corre primero `SELECT autores FROM literatura_referencias LIMIT 20;` y revisa que el separador que asume el script (`;` o `,`) coincide con tus datos.
2. `005_fix_submissions_ai_columns.sql` — agrega `ai_score`/`ai_feedback`/`metadata`/`evaluated_at` a `submissions`. Arregla un bug real y ya activo: `evaluate-submissions-ia` escribe en esas columnas desde antes de esta conversación, pero no existían — cada corrida fallaba en silencio y las entregas se quedaban reintentando para siempre en `ai_queued`.
3. `003_captura_review_columns.sql` — agrega las columnas de revisión humana (`ai_extracted_data`, `review_status`, etc.) a `capturas_campo` (ya existente, no se rompe nada) y `content_url`+revisión a `equipos_lab_logs`.
4. `002_graphrag_schema.sql` — activa la extensión `vector` (pgvector, gratis en Supabase) y crea las tablas de los dos grafos de conocimiento (`knowledge_nodes_docencia`/`knowledge_nodes_investigacion` + sus aristas y funciones de búsqueda) y `kalman_states` (estado del filtro de Kalman, genérico para cualquier señal).
5. `004_ai_calibration_schema.sql` — crea `ai_calibration_state`, donde `validate-ai-grading`/`calibrate-ai-thresholds` guardan el R²/RMSE real y el umbral de revisión humana calibrado. Ver `VALIDACION_Y_CALIBRACION.md` para el loop completo.
6. `006_rls_hardening_kalman_version.sql` — **CORRE ESTE LO ANTES POSIBLE, es un fix de seguridad, no una feature nueva.** Cierra dos policies RLS públicas (`perfiles.matricula_rfc` legible sin sesión, `telemetria_iot` insert/select sin sesión) encontradas en el doble check de `mds/05_A_DoubleCheck_QA_Tecnico.md` — ver `qa-05a-doublecheck/02-SOLUCION.md` para el detalle. También agrega `kalman_states.version` (requiere que el archivo 4 de esta lista, `002_graphrag_schema.sql`, ya haya corrido — si no, corre ese primero).
7. `007_rls_equipos_lab.sql` — **CORRE ESTE TAMBIÉN LO ANTES POSIBLE, mismo tipo de fix que el 6.** Cierra una tercera policy RLS pública (`equipos_lab` — SELECT sin sesión) que la ronda 1 del doble check no auditó (solo revisó `perfiles`/`telemetria_iot`, no el resto del árbol de políticas). Encontrada en la segunda ronda — ver `qa-05a-doublecheck-02/01-REPORTE.md` y `02-SOLUCION.md`. Sin dependencia de otros archivos, se puede correr en cualquier momento después del 6 (o antes, no importa).

Cada archivo es idempotente (`IF NOT EXISTS` / `CREATE OR REPLACE`) — si algo falla a medias, puedes volver a correrlo sin duplicar nada.

**⚠️ Orden real importa aquí, no solo entre los archivos de SQL**: `import-doi-metadata` (función, paso 4 de este documento) da por hecho que ya corriste el archivo 1 — inserta usando los nombres de columna *post-migración* (`url`, `autores` como array). `validate-ai-grading` (dominio `submission_grading`) da por hecho que ya corriste el archivo 5. Si despliegas esas funciones antes de correr su SQL correspondiente, van a fallar. Corre siempre SQL antes que el `deploy` correspondiente, no en paralelo.

## 2. Storage — crear un bucket nuevo

Dashboard → Storage → **New bucket**:

- Nombre: `materiales-docentes`
- Público: sí (igual que `campo-capturas`, que ya existe y sigue el mismo patrón)

Lo usa `copilot-execute-tool` para guardar los documentos/presentaciones/rúbricas que genera el Master Copilot. Los buckets `archivos_docentes` y `campo-capturas` ya existían y no se tocan.

## 3. Secrets — verificar que ya están configurados

Estas funciones nuevas usan las mismas secrets que ya tenías (no piden ninguna nueva):

- `GEMINI_API_KEY` — también cubre el endpoint de embeddings (`text-embedding-004`) que usa GraphRAG, es la misma API key, no hace falta una separada.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (las inyecta Supabase automáticamente en cada función)

Para confirmar qué hay configurado ahora mismo:

```bash
supabase secrets list
```

Si `GEMINI_API_KEY` no aparece:

```bash
supabase secrets set GEMINI_API_KEY=tu-key-aqui
```

## 4. Desplegar las funciones

Todas con la CLI de Supabase, desde `eui-reaserch-plataform-main/`. `_shared/` **no se despliega por separado** — no es una función, es código compartido que Supabase empaqueta automáticamente dentro de cada función que lo importa (`import ... from "../_shared/..."`). Basta con desplegar cada función normalmente:

**Funciones NUEVAS creadas esta sesión** (no existían antes, sin esto los botones de la UI que ya las invocan fallan):

```bash
supabase functions deploy analyze-literature-gaps
supabase functions deploy detect-cross-plagiarism
supabase functions deploy import-doi-metadata
supabase functions deploy search-literature
supabase functions deploy generate-tesis-feedback
supabase functions deploy generate-financial-report
supabase functions deploy build-knowledge-graph
supabase functions deploy graphrag-query
supabase functions deploy compute-student-risk-signals
supabase functions deploy compute-research-trends
supabase functions deploy analyze-capture
supabase functions deploy confirm-capture
supabase functions deploy copilot-execute-tool
supabase functions deploy validate-ai-grading
supabase functions deploy calibrate-ai-thresholds
```

**Funciones existentes que había que RE-desplegar** porque estaban rotas (import a archivos que no existían) y ahora ya compilan:

```bash
supabase functions deploy master-copilot-orchestrator   # dependía de _shared/copilotTools.ts, que no existía
supabase functions deploy sync-tablon                   # bug de tipos, ya arreglado
supabase functions deploy sync-attendance                # ídem
supabase functions deploy enroll-manual                  # ídem
supabase functions deploy import-ia-students              # ídem
supabase functions deploy provision-course-environment    # le faltaba una columna en el tipo
supabase functions deploy evaluate-submissions-ia          # escribía en columnas de submissions que no existían (SQL 5) + ahora lee confidence_threshold
supabase functions deploy bulk-evaluate-exams               # ahora lee confidence_threshold (SQL 4)
```

Y, en general, **todas las funciones que ya usan `_shared/auth.ts`/`_shared/gemini.ts`** (16+) deberían re-desplegarse al menos una vez si nunca se desplegaron con esos dos archivos reconstruidos — si ya las desplegaste después de la primera ronda de esta conversación, no hace falta repetirlo.

## 5. Nada de esto está conectado al frontend todavía

Excepto `master-copilot-orchestrator`/`copilot-execute-tool` (que sí tienen UI ya armada en `drive/nuevo` y `crear-ia`) y `analyze-literature-gaps`/`detect-cross-plagiarism`/`import-doi-metadata`/`search-literature`/`generate-tesis-feedback`/`generate-financial-report` (que también tienen UI ya armada), estas funciones son invocables pero **ningún botón las llama todavía**:

- `build-knowledge-graph` / `graphrag-query` (GraphRAG)
- `compute-student-risk-signals` / `compute-research-trends` (Kalman)
- `analyze-capture` / `confirm-capture` (ingesta humano-en-el-loop de Campo/Laboratorio)
- `validate-ai-grading` / `calibrate-ai-thresholds` (R²/RMSE y calibración) — sin UI propia, se corren bajo demanda (o programadas después). Su resultado SÍ lo consumen `bulk-evaluate-exams` y `evaluate-submissions-ia` (ya conectado), así que aunque no tengan botón propio, no están aisladas.

Conectarlas a una pantalla real es el siguiente paso, no algo pendiente de "despliegue".

**Asimetría a tener en cuenta en `analyze-capture`/`confirm-capture`**: para `domain='campo'` sí hay de dónde jalar datos reales — `/campo/captura` ya sube archivos a `capturas_campo` en producción. Para `domain='laboratorio'` NO — `equipos_lab_logs` nunca tuvo columna de archivo hasta el SQL 3, y ninguna pantalla existente sube uno. Desplegar la función no la vuelve usable ahí todavía; hace falta una UI de "subir foto de incidencia" en el módulo de Laboratorio primero, o insertar `content_url` a mano para probarla.

## 8. Custodia criptográfica — `012_custody_events.sql` (CORRE 4, ciberseguridad)

Añadido por separado del resto (viene de la auditoría de ciberseguridad, no de la sesión de GraphRAG/IA de arriba). Sin dependencia de ningún otro archivo de esta carpeta — se puede correr en cualquier momento, independiente del orden de `ORDEN_SQL.md`.

Qué crea: tabla `custody_events` (cadena de hashes SHA-256 append-only, RLS activo — solo lectura para `authenticated`, sin policy de escritura directa) + 3 funciones (`canonical_json`, `append_custody_event`, `verify_custody_chain`). El código de la app (`lib/server/custody.ts`) es un espejo en TypeScript probado con tests (`lib/server/custody.test.ts`, corren hoy sin necesitar esta migración aplicada), pero **hoy no está enganchado a ningún flujo de escritura real** — es la base lista para que, cuando se decida encadenar eventos reales (entregas, calificaciones, evaluaciones), el código que los escriba llame a `select * from append_custody_event(...)` en vez de un `insert` directo.

Después de correrlo en el SQL Editor, el smoke test manual (comentado al final del propio archivo `012_custody_events.sql`) inserta 2 eventos de ejemplo, verifica que la cadena es válida, simula una alteración directa de un payload y confirma que `verify_custody_chain()` la detecta — pégalo tal cual en el SQL Editor para comprobarlo con datos reales de tu proyecto.
