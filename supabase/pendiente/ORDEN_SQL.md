# Orden para correr los SQL pendientes

Revisé los 7 archivos en conjunto: **no hay dependencias de esquema entre ellos**, salvo el 6 que necesita que el 4 (`002_graphrag_schema.sql`) ya haya corrido (agrega una columna a una tabla que ese archivo crea). El resto puedes correrlo en cualquier orden y no rompen nada entre sí. El orden que sigue no es por dependencia de base de datos, sino por **riesgo** — primero seguridad activa, después el que puede necesitar que revises datos existentes, al final los que son inserts/adiciones nuevas sin ningún dato previo que perder.

| # | Archivo | Toca | Riesgo | Chequeo antes de correr |
|---|---|---|---|---|
| 1 | `006_rls_hardening_kalman_version.sql` | `perfiles`, `telemetria_iot` (cierra policies públicas), `kalman_states` (agrega columna `version`) | 🔴 Corrígelo primero — es seguridad activa (PII legible sin sesión), no una feature | Ninguno para las policies. La columna `version` requiere que `002_graphrag_schema.sql` (fila 5 de esta tabla) ya haya corrido — si no, corre ese antes. |
| 2 | `007_rls_equipos_lab.sql` | `equipos_lab` (cierra policy pública de SELECT) | 🔴 Corrígelo también cuanto antes — mismo tipo de hueco que el 006, encontrado en la segunda ronda del doble check (`qa-05a-doublecheck-02`) | Ninguno. Sin dependencias de otros archivos. |
| 3 | `001_fix_literatura_referencias_columns.sql` | `literatura_referencias` (renombra columnas existentes + cambia tipo de `autores`) | 🟡 Medio — transforma datos existentes | `SELECT autores FROM literatura_referencias LIMIT 20;` — confirma que el separador (`;` o `,`) coincide con tus datos reales antes de que el `regexp_split_to_array` corra sobre todo. |
| 4 | `005_fix_submissions_ai_columns.sql` | `submissions` (agrega 4 columnas) | 🟢 Bajo — solo `ADD COLUMN`, nada se transforma | Ninguno. Arregla un bug real: `evaluate-submissions-ia` lleva tiempo escribiendo en columnas que no existen (falla en silencio, los items se quedan reintentando para siempre). |
| 5 | `003_captura_review_columns.sql` | `capturas_campo` (agrega columnas), `equipos_lab_logs` (agrega columnas) | 🟢 Bajo — solo `ADD COLUMN` | Ninguno. |
| 6 | `002_graphrag_schema.sql` | Crea tablas nuevas (`knowledge_nodes_docencia`/`_investigacion` + aristas) y activa la extensión `vector` | 🟢 Bajo — todo nuevo, no toca tablas existentes | Ninguno, pero si tu plan de Supabase es el free tier verifica que `pgvector` esté disponible (lo está en todos los planes actuales, pero confírmalo si tienes un proyecto viejo). Debe correr antes que el archivo 1 de esta tabla si vas a respetar el orden estrictamente por dependencia en vez de por riesgo. |
| 7 | `004_ai_calibration_schema.sql` | Crea `ai_calibration_state` (tabla nueva) | 🟢 Bajo — todo nuevo | Ninguno. |

**Nota de dependencia real**: si corres en el orden de riesgo de arriba (006 primero), el `ALTER TABLE kalman_states ADD COLUMN version` del archivo 006 fallará si `002_graphrag_schema.sql` no corrió todavía. En ese caso corre primero el 5 (`002_graphrag_schema.sql`) y vuelve a correr el 006 después — es idempotente, no pasa nada por intentarlo dos veces.

## Por qué este orden y no otro

- **006 primero** porque cierra un hueco de seguridad activo (RLS pública sobre PII) — a diferencia del resto, esto no es una feature nueva pendiente de desplegar, es una vulnerabilidad ya explotable hoy con solo la anon key.
- **001 segundo** porque es el único restante que transforma datos que ya podrían existir en producción (`literatura_referencias`) — si algo sale mal ahí, es lo que más quieres detectar temprano.
- **005 tercero** porque arregla un bug que ya está afectando producción cada vez que alguien usa "Procesar con IA" en Entregas — cuanto antes se corrija, menos entregas se quedan atoradas reintentando.
- **003, 002, 004 al final** en ese orden porque son estrictamente aditivos (tablas/columnas nuevas, cero riesgo de tocar datos existentes) — el orden entre ellos tres es arbitrario, los puse en el orden en que se construyeron.

## Después de correr los 5

Revisa `README.md` (mismo folder) para el resto del despliegue: bucket de Storage, secrets, y qué función de Edge desplegar por cada SQL.
