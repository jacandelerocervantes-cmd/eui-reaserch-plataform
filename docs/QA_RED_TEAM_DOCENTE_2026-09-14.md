# QA Red Team — Flujo Docente (2026-09-14)

Sesión de pruebas end-to-end en producción (`https://eui-reaserch-plataform.vercel.app/`), rol docente, actuando como red team. **Solo observación y notas — ningún cambio se implementa en esta sesión.**

## 🔄 TRASPASO PARA NUEVA SESIÓN (contexto agotado 2026-09-14 ~04:00 UTC)

**Contexto operativo clave (leer primero):**
- Repo local sin `.git` en `EUI-Docencia-Plataforma/eui-reaserch-plataform-main/` — es un snapshot, no un clone. Para comitear/pushear a GitHub (`jacandelerocervantes-cmd/eui-reaserch-plataform`, rama `main`) hay que clonar aparte en el scratchpad, copiar SOLO los archivos que coinciden en ruta (la estructura de carpetas de GitHub está ~10 días desactualizada vs local — hay reorganización de route groups pendiente de sincronizar), comitear ahí y hacer push. `gh` ya está autenticado como `jacandelerocervantes-cmd` (device login ya hecho, sesión activa).
- Vercel CLI (`npx vercel`) ya autenticado y linkeado a `jacandelerocervantes-cmds-projects/eui-reaserch-plataform`. Deploy manual: `npx vercel deploy --prod` desde `eui-reaserch-plataform-main/`. `.vercelignore` ya corregido (antes era `vercelignore` sin punto, no se aplicaba — ya se creó el archivo correcto con el punto, excluyendo `env.local`/`.env.local`/`node_modules`).
- Supabase CLI linkeado al proyecto producción `inhauwsdbgtiofxxpggp` (EUI-Core-2026). `npx supabase db query "SQL" --linked` funciona para consultar directo. No existe `supabase functions logs` en esta versión de CLI — usar el dashboard: `https://supabase.com/dashboard/project/inhauwsdbgtiofxxpggp/functions/<nombre-funcion>/logs` (a veces tarda 5-10s en cargar, si sale en blanco recargar o cerrar/reabrir tab).
- **Rotación de credenciales YA COMPLETADA** esta sesión (login roto → arreglado): `SUPABASE_SERVICE_ROLE_KEY` filtrada en GitHub (`scripts/sync_existing_data.mjs`, ya limpiado en local, pendiente commitear ese archivo también) fue rotada e invalidada (verificado con 401). Legacy JWT keys de Supabase deshabilitadas. Código migrado de `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEYS` en 11 archivos (ya commiteado y pusheado a GitHub, commit `f53edef`). `QR_HMAC_SECRET` y `APPS_SCRIPT_SECRET` también rotados (Vercel + Supabase secrets + Google Apps Script `WEBHOOK_SECRET`). Login funcionando end-to-end confirmado.
- Materia de prueba creada: **"QA Red Team - Materia Prueba"** (id `ba00005d-e964-4d02-806b-62f2163baa8f`), 4 unidades, 4 alumnos ya cargados manualmente (QA0001 Ana, QA0002 Beto, A0001 Juan Perez [duplicado intencional de PRUEBA 1 para testear], QA0003 Juan Antonio Candelero con correo real `j.candeleroc@gmail.com`), 2 equipos creados (QA 1, QA 2).

**🔴 Pendiente inmediato al retomar — importación de PDF vía Gemini falló:**
Se subió `prelista_qa_test.pdf` (3 alumnos QA1001-1003, en el scratchpad de esta sesión, o regenerable con `make_prelista.py`) por "Importación Inteligente". Gemini extrajo los datos correctamente (100% de coincidencia mostrado en el modal de revisión), pero al confirmar (botón check azul) tiró error: **"Edge Function returned a non-2xx status code"**. Se verificó en la BD que **no se insertó nada** (tabla `students`, course_id de la materia QA, solo tiene los 4 alumnos manuales, sin QA1001-1003).
- El usuario bajó un export de logs de Supabase a `C:\Users\anton\Downloads\supabase_logs.json` — muestra **varios 504 (Gateway Timeout) intermitentes** en `/auth/v1/user` y `/rest/v1/profiles` durante la ventana de tiempo relevante. Hipótesis más probable: la Edge Function que procesa la confirmación de prelista (probablemente `import-ia-students`, no confirmado con certeza — falta revisar su código/logs específicos) hace una llamada interna (verificar sesión/rol del docente vía `/auth/v1/user` o `/rest/v1/profiles`) que expiró con 504, y el error se propagó como fallo genérico al frontend sin insertar nada.
- **Siguiente paso concreto**: revisar `supabase/functions/import-ia-students/index.ts` (o la función real que atiende este flujo — confirmar cuál es inspeccionando `components/` de la página de Alumnos) para ver qué llamada podría estar expirando, y/o reintentar la subida del mismo PDF ahora (los 504 podrían haber sido transitorios) para ver si ya funciona. Si vuelve a fallar, revisar `supabase functions logs import-ia-students` vía dashboard (Invocations tab tiene el detalle de cada request/response, más útil que Logs tab para ver el body del error).

**✅ CAUSA RAÍZ IDENTIFICADA (2026-09-14, sesión de retoma) — confirmada por lectura de código, no reproducida en vivo aún:**
- Función real confirmada: `supabase/functions/import-ia-students/index.ts`, modo `commit` (línea 151-186), invocada desde `handleCommitImport` en `app/(docente)/panel/materias/[id]/alumnos/page.tsx:249-284` al hacer clic en el check azul.
- `verifyDocente(req)` se llama en la línea 134, **antes de entrar al bloque `try`** de la línea 147 (fuera de cualquier manejo de error propio de la función). Internamente (`supabase/functions/_shared/auth.ts:54-73`, función `verifyUser`) hace dos llamadas de red **sin ningún retry ni timeout propio**:
  1. `callerClient.auth.getUser()` → golpea `/auth/v1/user`
  2. `select role from profiles` → golpea `/rest/v1/profiles`
  
  Son exactamente los dos endpoints que el log de Supabase (`supabase_logs.json`) mostró con 504 intermitentes en la ventana de tiempo relevante.
- Si cualquiera de esas dos llamadas expira, `verifyUser` devuelve `{ok:false, status:401, "No se pudo verificar tu sesión."}` y la función corta ahí — **nunca llega al código de inserción**, consistente con que la BD quedó en cero filas nuevas (QA1001-1003 no aparecen). El cliente `supabase-js` en el frontend, al no poder extraer el mensaje específico del cuerpo de una respuesta 401 en este flujo, cae al genérico `"Edge Function returned a non-2xx status code"` — exactamente el error visto en pantalla.
- **Alcance más amplio que solo esta función**: `verifyUser`/`verifyDocente`/`verifyAlumnoSandbox` son compartidos por *todas* las Edge Functions autenticadas de la plataforma. Cualquier 504 transitorio de Supabase Auth/PostgREST (fuera de nuestro control) puede tumbar silenciosamente cualquier acción autenticada, sin pista útil para el usuario. Esto es un hallazgo de **resiliencia de arquitectura**, no un bug aislado de importación de alumnos.
- **No implementado aún** (sesión de observación): posible mitigación sería (a) agregar retry con backoff corto (1-2 reintentos) a esas dos llamadas dentro de `verifyUser`, y (b) que el frontend distinga "sesión expirada, vuelve a iniciar sesión" de "error transitorio del servidor, reintenta" en vez de mostrar el mismo mensaje genérico para ambos. Pendiente de decisión del usuario antes de tocar código compartido tan sensible.
- **Siguiente paso real**: reintentar la subida del mismo PDF ahora en producción — si los 504 fueron transitorios, debería funcionar sin cambios de código.

**✅ RESUELTO (2026-09-14, sesión de retoma):**
- Fix aplicado en [`_shared/auth.ts`](../supabase/functions/_shared/auth.ts): `verifyUser()` reemplazó `auth.getUser()` (round-trip obligado a `/auth/v1/user` en cada request) por `auth.getClaims()` (verificación local de firma JWT vía JWKS cacheado, sin red en el caso normal), envuelto además en el mismo `selectWithRetry` (1 reintento, 400ms) que ya protegía la consulta a `profiles`/`courses`. Aplicado también a `verifyCourseOwnership`.
- Desplegado con `npx supabase functions deploy import-ia-students` (empaqueta `_shared/auth.ts`). **Pendiente**: el resto de Edge Functions que importan `_shared/auth.ts` siguen corriendo el código viejo hasta que se redesplieguen — no se hizo un deploy masivo a propósito, para no mezclar cambios sin probar cada una.
- **Contexto importante descubierto en el camino**: los 504 coincidieron en el tiempo con una migración de Supabase al nuevo sistema de llaves (`SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` — todos con `updated_at` sincronizado a las 04:00:51 UTC, justo después de la ventana de 504s de las 03:29–03:58). Es decir, la inestabilidad probablemente fue la ventana de esa migración de infraestructura de Supabase, no un problema permanente. El fix de todos modos queda como buena práctica de resiliencia para el futuro.
- **Verificado en producción**: se resubió `prelista_qa_test.pdf` (regenerado en esta sesión, mismo contenido QA1001-1003) y la importación completó sin error. Total de alumnos en la materia QA pasó de 4 a 7.
- **Pendiente de decisión, no implementado**: `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (usadas hoy en `_shared/auth.ts`) están marcadas "Deprecated" por Supabase — siguen funcionando (inyectadas automáticamente como alias legacy) pero podrían desaparecer sin aviso. Migrar a `SUPABASE_SECRET_KEYS`/`SUPABASE_PUBLISHABLE_KEYS` (JSON dict, formato no confirmado — la CLI no expone el valor en claro) queda pendiente como tarea aparte. También queda pendiente evaluar verificación 100% local del JWT usando el secret `SUPABASE_JWKS` directo (cero red, ni siquiera la primera vez), en vez de `getClaims()` que sí depende de una descarga inicial del JWKS.
- **Nota de datos, no de código**: el correo autogenerado en la importación por IA salió como `lqa1001@tizimin.tecnm.mx` (con "l" antes de la matrícula). Según indicó el usuario, el formato correcto no debe llevar esa "l" — es solo el número de matrícula. Además, el usuario aclaró que la ausencia de correo en altas manuales ("No registrado") es una decisión intencional (para no invitar por error a un alumno real), no un bug.

**🆕 Pendientes de diseño/validación agregados por el usuario (no implementar aún):**
- **Quitar el botón "Crear Accesos" de `Gestión de Alumnos`** (el ícono de llave, `handleProvisionAccounts` → función `provision-student-accounts`). El usuario considera que crear accesos/cuentas de alumnos debería ser una acción de **administrador**, no algo que el docente dispare desde esta pantalla. Pendiente decidir dónde debería vivir en su lugar (¿panel de admin?).
- **Validar que no haya sobrescritura de datos cuando un mismo alumno está en 2, 3 o más materias a la vez.** Relacionado directamente con el bug arquitectónico ya confirmado arriba (duplicación de alumnos entre materias, fila independiente por `course_id`): falta una prueba explícita de qué pasa si se edita nombre/correo de un alumno en una materia mientras también está en otras — confirmar si de verdad no hay ningún cruce/sobrescritura accidental entre las filas de `students` de distintas materias, o si existe algún flujo (ej. sync con Sheets, provisión de cuentas) que sí las cruce por error.
- ✅ **Probado (2026-09-14, sesión de retoma)**: se subió `alumno_extra_qa_test.csv` (1 alumno, Marina Chan, matrícula QA1004) — el flujo sí acepta CSV además de PDF/Imagen/Excel (pasa por la rama "texto plano" de `import-ia-students/index.ts`, que decodifica el archivo y se lo manda a Gemini como texto). Extracción 100% correcta e inscripción exitosa. Total de alumnos en la materia QA: 8.

**Hallazgos de diseño/bugs ya confirmados y documentados abajo** (no repetir el trabajo, ya está anotado): modal Editar Asignatura incompleto, pantalla Unidades con inconsistencias visuales, bug de guardado silencioso en Configurar Unidad, checkbox roto en selector de equipos (hay que hacer click en el texto no en el cuadrito), **bug arquitectónico de duplicación de alumnos entre materias** (confirmado con query SQL, cada materia crea su propia fila en `students` para "el mismo" alumno — no hay identidad única de alumno), falta asignación de puntos por actividad/examen individual, modal de Importación Inteligente sobrecargado de texto/expone nombre del modelo IA.

**Reglas de diseño acordadas con el usuario** (aplicar cuando se implemente, ver sección abajo): un solo mecanismo de cierre por modal (la X, quitar "Cancelar" redundante), "Eliminar"/"Cerrar" quedan como ícono fijo sin texto, el resto de botones de acción como "expand buttons" (ícono que expande a texto en hover).

## ✅ Implementación de los 16 puntos (2026-09-14, sesión de retoma)

A pedido explícito del usuario, se implementaron y desplegaron a producción los 16 hallazgos de UI/bugs ya confirmados (dejando expresamente pendientes las decisiones de arquitectura: duplicación de alumnos entre materias, migración de `_shared/auth.ts` a `SUPABASE_SECRET_KEYS`/`PUBLISHABLE_KEYS`). Verificado en vivo en producción tras el deploy:

1. **Configurar Unidad — guardado inválido ya no cierra en silencio**: ahora bloquea el guardado y muestra un banner de error rojo ("El total debe sumar 100 pts antes de guardar") si el total ≠ 100. Verificado en vivo.
2. **Colores de categoría unificados** entre modal y (antigua) card: Asistencia ahora gris neutro, Actividades azul, Evaluaciones ámbar, consistentes.
3. **Spinner nativo oculto** en todos los inputs de puntos del modal (clase `pts-input` con CSS scoped).
4. **Checkbox de "Seleccionar Alumnos para Formar Equipo"**: revisado en código — el `onClick` ya está en el `<label>` completo (bubbling cubre el cuadrito). No se reprodujo el bug contra el código actual; posible que ya estuviera resuelto de una iteración anterior. No se tocó nada aquí.
5. **`.trim()` agregado** en `enroll-manual/index.ts` para matrícula/nombres/apellidos al crear o editar alumnos manualmente.
6. **5 `alert()`/`confirm()` nativos reemplazados** por banners propios de la UI en `useAsistencia.ts` (Pase de Lista) y `useHistorial.ts` (Historial) — ya no bloquean el hilo de JS ni rompen el diseño.
7. **Modal "Editar Asistencia"**: quitado el botón "Cancelar" redundante (solo queda la X); input de archivo nativo reemplazado por dropzone estilizado.
8. **Tabla de Historial**: celdas de asistencia con hover visible (affordance de que son clickeables); columnas "%" y "Examen" fusionadas en una sola con badge de color.
9. **Botón "Sellar Asistencia"**: ahora rojo/advertencia (antes navy genérico) y su confirmación pasó de un `confirm()` nativo a un modal propio de la UI con ícono de alerta.
10. **Modal "Editar Asignatura"**: agregada X para cerrar, quitado "Cancelar", "Eliminar Materia" ahora ícono fijo sin texto, "Guardar" como expand button. **Año/Semestre editables quedó pendiente**: la tabla `courses` no tiene esas columnas — requiere migración de base de datos, se trató como ítem de arquitectura y no se implementó.
11. **Modal "Importación Inteligente"** (alumnos y equipos): quitado el badge "MOTOR GEMINI 2.5 FLASH", quitado el texto duplicado, el botón principal de análisis ahora siempre visible con texto (antes colapsado a solo-ícono, se veía huérfano).
12. **Paleta `#2563eb`/`#eff6ff` reemplazada por navy institucional** (`#1B396A`/`#eef2f8`) en los badges de ícono de Equipos (`TeamsGrid.tsx`, `StudentPickerList.tsx`) — limitado a las pantallas confirmadas esta sesión, no se tocaron pantallas del lado alumno sin revisar.
13. **Pantalla Unidades**: creación de unidad convertida a modal (antes caja inline con borde punteado); grid corregido (`auto-fit` en vez de `auto-fill`, ya no deja hueco al agregar una 4ta unidad); cards simplificadas (ya no repiten el desglose completo, dice "100 pts distribuidos en 3 categorías — ver detalle en Configurar Unidad"); "Configurar Unidad" ahora expand button, "Eliminar" ícono fijo.
14. **Toggle global "Puntos/Porcentaje" eliminado** (confirmado por el usuario): todo queda en puntos, el % se muestra solo como dato de lectura junto a cada tarea individual dentro de "Actividades y Tareas" (el desglose por tarea individual ya existía en el modal, solo se simplificó quitando el modo alterno).
15. **Botón "Crear Accesos" eliminado** de Gestión de Alumnos (junto con su lógica y banner de resultado) — decisión pendiente de dónde debería vivir esa acción (¿panel de admin?).
16. **Correo autogenerado corregido**: `l{matricula}@tizimin.tecnm.mx` → `{matricula}@tizimin.tecnm.mx` (sin la "l") en `import-ia-students/index.ts`.

**Desplegado**: Edge Functions `enroll-manual` e `import-ia-students` vía `supabase functions deploy`; frontend completo vía `vercel deploy --prod` (confirmado por el usuario antes de ejecutar). `tsc --noEmit` y `eslint` corridos antes del deploy — sin errores en los archivos tocados.

## ✅ Migraciones pendientes — reconciliadas (2026-09-14)

Las 9 migraciones que aparecían "sin aplicar" en `supabase migration list` se investigaron y aplicaron con autorización explícita del usuario en cada paso sensible. Hallazgo principal: **8 de las 9 ya estaban aplicadas de facto en producción** (alguien corrió ese SQL directo, sin pasar por el historial de migraciones — por eso el tracker las marcaba como pendientes aunque el efecto ya existía). Se confirmó contra el schema real antes de tocar nada: RLS de `perfiles`/`telemetria_iot`/`equipos_lab`/`horarios_docente` ya estaba correctamente restringida (no había ninguna vulnerabilidad activa), políticas de `course_units`/`assignments` ya existían, extensiones `vector`/`pg_cron` ya instaladas.

**Problemas reales encontrados y corregidos durante el `db push`** (cada uno con autorización del usuario antes de ejecutar en producción):
1. `profiles.access_level` — el `ALTER TABLE ADD COLUMN` no tenía `IF NOT EXISTS` y la columna ya existía → se agregó el guard.
2. `ai_calibration_state` — la tabla real en producción tenía un esquema **completamente distinto e incompatible** al que el código actual (`calibrate-ai-thresholds`, `bulk-evaluate-exams`, `evaluate-submissions-ia`) espera. Investigado: el código vigente usa exactamente las columnas de la migración (`domain`, `r2`, `confidence_threshold`, etc.), así que la tabla real era la huérfana/desactualizada, no al revés. Estaba vacía (0 filas, sin FKs) → se hizo `DROP TABLE` (autorizado) y se dejó que la migración la recreara con el esquema correcto que el código realmente usa.
3. `literatura_referencias` (renombrar columnas + convertir `autores` a array) — ya se había aplicado antes; se reescribió el bloque con chequeos condicionales (`information_schema`) para que sea idempotente sin importar el estado de la base.
4. Tabla **`perfiles`** (español) referenciada en una policy — **nunca existió**; la tabla real es `profiles` (inglés). Confirmado por el usuario: "todas las tablas en inglés son las correctas". Se quitó esa sección muerta del archivo (la policy equivalente en `profiles` ya estaba correcta).
5. Políticas de `telemetria_iot` — el `DROP POLICY IF EXISTS` apuntaba al nombre viejo de la policy, no al nuevo que ya existía → se agregó un segundo `DROP POLICY IF EXISTS` con el nombre nuevo antes de recrearla.
6. `rag_benchmark_questions` — **bug real en la migración original**: la tabla se creaba sin `PRIMARY KEY` en `id`, por lo que `rag_benchmark_results.question_id` no podía tener su FK. Se agregó `primary key` a la columna `id` (autorizado, tabla recién creada sin datos).

**Resultado final**: `supabase migration list --linked` muestra las 14 migraciones con `local == remote` — historial completamente sincronizado. Se creó de forma nueva el esquema Medallón Bronce/Plata/Oro (`bronze`/`silver`/`gold`, con refresco automático cada 6h vía `pg_cron`) para análisis de riesgo académico sin fuga de datos entre train/validation/test.

## ✅ Año/Semestre editable en "Editar Asignatura" — completado (2026-09-14)

Con las migraciones ya reconciliadas, se agregó la migración `20260914000000_courses_semester_year.sql` (columnas `year integer` y `semester text` en `courses`, nullable, con `check` de valores válidos para semester). Cambios de código:
- `CourseModal.tsx`: Año y Semestre ahora se muestran y son editables tanto al crear **como al editar** una materia, ambos como `<select>` (nunca texto libre, según lo acordado). "Número de Unidades" se quedó exclusivo de creación, como estaba decidido.
- `usePanelDocente.ts`: `Course` incluye `year`/`semester`; `handleEditCourse` ahora persiste ambos campos al guardar.
- `panel/page.tsx`: precarga `initialYear`/`initialSemester` desde la materia al abrir el modal de edición.

**Verificado en producción**: se cambió el Año de "QA Red Team - Materia Prueba" a 2026 desde el modal y se confirmó directo en base de datos (`year: 2026, semester: "Enero - Julio"`) — persiste correctamente.

## ✅ Duplicación de alumnos entre materias — resuelto (2026-09-14)

Investigado antes de decidir: `students.id` es un UUID aleatorio por fila (no la matrícula); `enrollments` (tabla ya existente) resultó ser para otra cosa (alumnos con cuenta real vía `profiles`, piloto de tutor IA) — no aplicaba aquí. Se confirmaron 3 duplicados reales en producción antes de tocar nada: `A0001` (Juan Perez, agregado a propósito en esta sesión para probar el bug), `A003` (JOSE PEREZ) y `A004` (MANUEL DELGADO) — estos dos últimos ya existían antes de esta sesión, inscritos legítimamente en PRUEBA 1 y PRUEBA 2 como registros completamente desconectados.

**Solución implementada (Fase 1 + Fase 2 del roadmap acordado):**
- Migración `20260914010000_student_profiles_global_identity.sql`: tabla nueva `student_profiles` (identidad única por matrícula a nivel institución — nombre en inglés a propósito, paralelo a `profiles`) + columna `students.student_profile_id` (FK, nullable, aditiva — no se quitó ni rompió nada existente). Backfill automático: 128 perfiles creados (uno por matrícula única de los 131 registros de `students` que había), los 3 duplicados quedaron correctamente enlazados a un solo `student_profile_id` cada uno.
- `enroll-manual/index.ts`: en modo `create` resuelve-o-crea en `student_profiles` antes de insertar; en modo `edit`, si cambia nombre/apellidos/correo, actualiza `student_profiles` y propaga el cambio (fan-out `UPDATE`) a **todas** las filas de `students` que compartan ese `student_profile_id`.
- `import-ia-students/index.ts` (`executeSmartMerge`): mismo patrón de resolver-o-crear perfiles, en lote, para altas por PDF/CSV/Excel.
- `import-ia-teams/index.ts`: revisado — no crea alumnos nuevos (solo asigna existentes a equipos), no requirió cambios.
- Deliberadamente **no se tocaron** los otros 34 archivos que solo leen `students` por `id`/`course_id` (asistencia, calificaciones, evaluaciones, equipos, historial, todas las páginas del lado alumno) — siguen funcionando exactamente igual porque `students` conserva todas sus columnas actuales.

**Verificado en producción de punta a punta**: se agregó un alumno nuevo en "QA Red Team" con matrícula `A003` (ya existente en PRUEBA 1/PRUEBA 2) — se resolvió automáticamente al `student_profile_id` ya existente en vez de crear uno nuevo. Se editó el apellido desde esa materia y **se propagó correctamente a las 3 materias** (PRUEBA 1, PRUEBA 2, QA Red Team) y a `student_profiles` — el bug de "edito en una materia y no se refleja en la otra" queda resuelto de raíz.

**Correcciones adicionales encontradas y aplicadas durante este trabajo** (bugs reales en migraciones previas, no solo faltas de guard):
- `profiles.access_level`: faltaba `IF NOT EXISTS` en el `ADD COLUMN`.
- `ai_calibration_state`: la tabla real en producción tenía un esquema completamente distinto e incompatible con el código actual (`calibrate-ai-thresholds`, `bulk-evaluate-exams`, `evaluate-submissions-ia`) — estaba vacía, se recreó con el esquema correcto que el código realmente usa.
- Tabla `perfiles` (español) referenciada en una policy nunca existió — la tabla real es `profiles` (inglés, confirmado por el usuario).
- `rag_benchmark_questions`: bug real — se creaba sin `PRIMARY KEY` en `id`, rompiendo la FK de `rag_benchmark_results`.

## ✅ Refinamiento de permisos e identidad — decisión del usuario (2026-09-14)

Tras validar la Fase 2, el usuario aclaró dos reglas de negocio que cambian el alcance de lo que un **docente** puede hacer sobre la identidad de un alumno (todo lo demás de la Fase 2 se mantiene sin cambios):

1. **Nombre, apellidos, matrícula y correo son datos institucionales — solo un administrador puede corregirlos una vez que el alumno ya está registrado.** El docente nunca vuelve a editar esos campos desde su materia.
2. **La única acción del docente sobre un alumno ya inscrito es agregarlo o quitarlo de su materia** — no existe un "editar alumno" separado.

**Cambios implementados como consecuencia:**
- `enroll-manual/index.ts`, modo `edit`: ahora ignora explícitamente `apellido_paterno`, `apellido_materno`, `nombres`, `matricula` y `correo` del payload entrante (los conserva tal cual estaban) — cualquiera que sea el valor recibido, no se aplican. Se quitó la función `propagateIdentityToProfile` (ya sin uso).
- **Nuevo modo `lookup`** en la misma función: dado un `matricula`, busca en `student_profiles` y devuelve solo la identidad (nombre/apellidos/correo) si ya existe — nunca en qué otras materias está inscrito, para no exponer el roster de un docente a otro. Requiere estar autenticado como docente, pero no `courseId` (la búsqueda es previa a decidir la materia).
- Frontend (`alumnos/page.tsx`): se quitó por completo el botón/flujo "Editar Alumno" — la tabla ahora solo tiene "Quitar de la Materia" (antes "Eliminar", mismo texto de confirmación aclarado: "No afecta su registro en otras materias"). El modal "Nuevo Alumno" ahora busca automáticamente (debounce 500ms) al escribir la matrícula: si ya existe, autocompleta y **bloquea** nombre/apellidos/correo con un aviso visual ("Esta matrícula ya está registrada..."); si es nueva, los campos quedan editables normalmente para el primer registro.

**Verificado en producción de punta a punta**: se agregó "MANUEL DELGADO" (matrícula `A004`, ya inscrito en PRUEBA 1/PRUEBA 2) a la materia QA Red Team escribiendo solo la matrícula — el sistema autocompletó y bloqueó nombre/apellido/correo automáticamente, y la nueva inscripción quedó correctamente enlazada al mismo `student_profile_id` que las otras dos. Confirmado en base de datos: las 3 materias comparten identidad.

**Pasos del plan original aún no iniciados**: Paso 5 (crear 2 actividades y 2 exámenes), Paso 6 ya adelantado (alumno de validación `j.candeleroc@gmail.com` ya está en la materia QA). Después de eso: validar del lado alumno con esa cuenta, y retomar la sincronización GitHub↔local↔Supabase de migraciones/Edge Functions que se dejó pendiente (9 migraciones sin aplicar en producción, 6 Edge Functions locales sin desplegar — ver conversación anterior a esta sesión de QA, no repetida aquí por espacio).

---

## Reglas de la sesión
- Login y consentimientos OAuth los da el usuario (Antonio), nunca el agente.
- Datos de prueba: correos de alumnos deben usar un dominio que NO sea el actual ni el anterior de la institución, para no disparar invitaciones/notificaciones a personas reales.
- Alumno de validación real: `j.candeleroc@gmail.com` (se agregará a la materia de prueba para la fase de validación como alumno, fuera de esta sesión). **`j.candeleroc@gmail.com` es la ÚNICA excepción a la regla institucional** — cualquier otro alumno de prueba/real debe usar `matricula@ittizimin.edu.mx`.

## Pendientes de mejora ya identificados (fuera de este flujo, no implementar aún)
1. **Dominio de correo institucional de alumnos incorrecto en el código actual.** El correo real de alumnos es `matricula@ittizimin.edu.mx`. Verificar dónde está hardcodeado/mal configurado el dominio actual y corregirlo.
2. **Login docente**: mantener abierto con cualquier cuenta de Google (no forzar dominio institucional), aunque exista cuenta institucional.
3. **[CORREGIDO] Duplicar/exportar actividades y exámenes entre grupos o materias**: el docente crea una actividad y un examen por grupo manualmente. Si una materia tiene grupo A y B (o si el mismo contenido aplica a lo largo de varias materias), no existe forma de exportar/duplicar una actividad o examen ya creado hacia otro grupo/materia — hay que rehacerlo desde cero cada vez. Falta un botón de "duplicar a otro grupo/materia".
4. **Tablón — toggle de comentarios es global, debería ser por anuncio**: hoy el activar/desactivar comentarios es un control único a nivel de todo el Tablón. Debe ser un botón sencillo por cada anuncio individual, siguiendo el diseño ya existente (icono/toggle en cada tarjeta de anuncio, no un control global aparte).

## Flujo a probar (en orden)
1. Login (docente)
2. Crear materia → semestre → número de unidades
3. Modificar unidades y ponderaciones → verificar que el modal no se vea raro y mantenga el diseño del resto de la página
4. Subida de alumnos vía Edge Function manual (PDF falso con correos de dominio ficticio) + creación de grupos
5. Crear 2 actividades y 2 exámenes
6. Agregar a `j.candeleroc@gmail.com` como alumno de la materia

---

## Principio de diseño global para botones (aplica a todos los modales)

- **Un solo mecanismo para cerrar/cancelar por modal**: la "X" en la esquina superior derecha. Es redundante tener además un botón de texto "Cancelar" — quitarlo donde exista y dejar solo la "X".
- **"Eliminar" y "Cerrar" (la X) se quedan como íconos simples fijos**, sin texto — su ícono ya es universalmente entendido (basura = eliminar, X = cerrar), no necesitan ninguna interacción extra.
- **Todos los demás botones de acción** (ej. "Guardar", "Configurar") deben ser **"expand buttons"**: por defecto solo ícono (compactos), y se expanden mostrando el texto en hover/focus — sobre todo aquellos cuyo ícono ya es autoexplicativo (ej. disquete = guardar).
- Este criterio reemplaza cualquier nota anterior que pedía texto+ícono de ancho fijo — aplica de forma consistente a **todos** los modales de la plataforma (Editar Materia, Configurar Unidad, y los que sigan revisándose).

## Hallazgos (organizados por paso del flujo de pruebas)

### Paso 1 — Login
✅ Resuelto en esta misma sesión (ver historial de chat): login roto por rotación de API keys de Supabase, arreglado migrando a `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEYS` + actualización de `@supabase/supabase-js`/`@supabase/ssr`. Sin hallazgos de diseño pendientes en este paso.

### Paso 2 — Crear materia → semestre → número de unidades

**Modal "Editar Asignatura"** (`components/courses/CourseModal.tsx`, usado desde `app/(docente)/panel/page.tsx`):
- Hoy solo tiene el campo "Nombre de la Asignatura". No se puede editar Año ni Semestre después de crear la materia.
- No tiene "X" para cerrar (solo "Cancelar" de texto) — no sigue el principio de diseño global de botones (ver sección arriba).

**Cambios a implementar** (no hacer aún, solo queda anotado):
- **Número de Unidades**: NO debe ser editable aquí (se queda como está, sin campo).
- **Año** y **Semestre**: SÍ deben poder editarse, con un `<select>` (dropdown), nunca input de texto libre — para que el docente no cometa un error de formato al escribir a mano.
- Aplicar el principio de diseño global de botones: quitar "Cancelar", agregar "X" de cerrar, "Eliminar Materia" como ícono fijo (sin texto), "Guardar" como expand button.

### Paso 3 — Modificar unidades y ponderaciones

**Pantalla "Unidades de Aprendizaje"** (ruta `app/(docente)/panel/materias/[id]/unidades`, archivo de componente exacto sin confirmar):
- **Patrón de creación inconsistente**: crear una *materia* abre un modal centrado con overlay oscuro; crear una *unidad* usa una caja con borde punteado insertada directo en la página ("Nueva Unidad 4") — dos patrones de UI distintos para la misma acción conceptual. Deberían ser consistentes (idealmente ambos como modal).
- **Grid descuadrado al agregar una 4ta unidad**: las primeras 3 llenan una fila de 3 columnas parejas; la Unidad 4 queda sola en una segunda fila ocupando 1/3 del ancho, con espacio vacío grande a la derecha.
- **Colores de los pills (Asistencia/Actividades/Evaluaciones) fuera de la paleta institucional**: azul claro/verde/amarillo genéricos de librería UI, sin relación con la paleta navy/dorado del resto de la plataforma.
- **Botones "Configurar Unidad" / "Eliminar" de cada card**: "Configurar Unidad" se estira mucho más de lo que su texto necesita mientras "Eliminar" sí queda ajustado a su contenido. Aplicar principio de diseño global: "Configurar Unidad" como expand button, "Eliminar" como ícono fijo sin texto.
- **Información redundante en cada card**: las 3 tarjetas repiten el desglose completo (Asistencia/Actividades/Evaluaciones) aunque sean valores por defecto idénticos — satura la vista. Ese desglose debería vivir solo dentro de "Configurar Unidad"; la card debería mostrar menos (ej. título + sesiones + total de puntos).

**Modal "Configurar Unidad"** (mismo componente/ruta de Unidades):
- ✅ Funcional: la validación de suma de puntos sí funciona (banner cambia de verde "100 pts (100%)" a ámbar "⚠ Total: 110 pts (debe sumar 100)" al desbalancear).
- 🔴 **Bug confirmado**: al hacer clic en "Guardar Cambios" con el total inválido (110 pts), correctamente NO se guarda (la card sigue en 10 pts) — pero el modal se cierra igual **sin ningún mensaje de error**. El docente no tiene forma de saber que su cambio fue rechazado. Debe mostrar un toast/error y no cerrar el modal en ese caso.
- ✅ Este modal sí tiene "X" para cerrar (a diferencia del de Editar Materia) — es la referencia correcta a seguir.
- **Colores de categoría no coinciden con la card de la lista**: en la card, Asistencia=azul, Actividades=verde, Evaluaciones=amarillo; en el modal, Asistencia=sin color, Actividades=azul, Evaluaciones=amarillo. Deben coincidir.
- Los inputs de "pts" muestran las flechitas nativas del navegador (spinner default), mientras "Título de la Unidad" y "Sesiones" tienen estilo custom — falta estilizar los inputs de pts igual que los demás.
- Aplicar principio de diseño global de botones: quitar "Cancelar" (ya tiene X), "Guardar Cambios" como expand button.

**Lógica de calificación — falta asignación de puntos por actividad/examen individual:**
- Asistencia está bien tal cual: se calcula automático según el % real de asistencia del alumno sobre los puntos asignados (ej. 10 pts, 100% asistencia = 10 pts, 80% = 8 pts).
- El problema es en **Actividades** y **Evaluaciones**: dentro de la categoría (ej. Actividades = 40 pts de la unidad) puede haber varias actividades individuales, y hoy no hay forma de que el docente decida cuántos puntos vale **cada actividad/examen individual** dentro de ese total (ej. Actividad 1 = 20 pts, Actividad 2 = 20 pts, sumando 40). Cada actividad/examen se califica internamente sobre 100 (su propia rúbrica), y ese resultado se pondera según los puntos asignados dentro de la categoría.
- **Opinión del agente (pendiente de que Antonio confirme)**: quitar el toggle global "Puntos (pts) / Porcentaje (%)" de la categoría. Si cada actividad va a tener su propio valor en puntos que suman al total, un modo "por porcentaje" a nivel categoría agrega un segundo modelo mental innecesario. Dejar todo en puntos, y mostrar el porcentaje solo como dato calculado de lectura (ej. "Actividades: 40 pts — 40% del total"), no como modo de captura editable.

### Paso 4 — Subida de alumnos (Edge Function manual) + grupos

**Modal "Nuevo Alumno"** (botón persona+ en "Gestión de Alumnos"):
- ✅ Buen ejemplo de diseño a favor: tiene X para cerrar y un único botón de guardar solo-ícono (disquete), sin "Cancelar" — sigue el principio de diseño global ya definido. Usar como referencia para corregir los demás modales.
- Los botones de acciones de la tabla (editar=lápiz, eliminar=basura) ya son solo-ícono — otro buen ejemplo existente.

**Inconsistencia de orden de nombre** (menor, revisar si es intencional):
- Tabla "Gestión de Alumnos" muestra "Nombre Completo" como `Apellido Paterno + Apellido Materno + Nombre` (ej. "Pruebalo Testigo Ana").
- El selector de "Equipos de Trabajo" muestra `Apellido Paterno + Nombre` (sin materno) (ej. "Beta Beto").
- Dos formatos distintos de armar el mismo nombre en dos pantallas de la misma sección — unificar criterio.

**Modal "Seleccionar Alumnos para Formar Equipo":**
- 🔴 **Bug confirmado**: el checkbox visual junto a cada alumno **no responde al clic** — hacer clic exactamente sobre el cuadrito no lo marca. Hay que hacer clic sobre el **texto del nombre** para que sí se seleccione. El hit-area del checkbox no está conectado (o es demasiado pequeño) al manejador de selección.

**Modal "Nombrar Equipo":**
- ✅ Buen ejemplo de diseño: X para cerrar + un único botón de guardar solo-ícono. Mismo patrón correcto que "Nuevo Alumno".

**Resultado**: Equipo "Equipo QA 1" creado correctamente con los 2 alumnos de prueba (QA0001, QA0002) — flujo funcional de punta a punta pese al bug del checkbox.

**Multi-equipo — ✅ funciona correctamente**: se confirmó que un mismo alumno (Ana) puede pertenecer a varios equipos a la vez ("Equipo QA 1" y "Equipo QA 2" simultáneamente) sin ningún error. No hace falta cambio aquí.

**Alumno de validación agregado**: se creó QA0003 "Candelero Cervantes Juan Antonio" con correo `j.candeleroc@gmail.com` — este es el alumno real que se usará para la fase de validación del lado alumno (fuera de esta sesión).

**🔴 Bug arquitectónico confirmado — duplicación de alumnos entre materias**: se agregó a "QA Red Team - Materia Prueba" un alumno con la misma matrícula (`A0001`, "Perez Lopez Juan") que ya existía en la materia "PRUEBA 1". La UI no mostró ningún aviso de duplicado. Se verificó directo en la base de datos (tabla `students`) y **existen dos filas distintas** con la misma matrícula `A0001`, cada una con su propio `id` y ligada a un `course_id` distinto:
  - `id: db13cc7a...` → course_id de PRUEBA 1
  - `id: 91de33df...` → course_id de QA Red Team
  
  Esto confirma que la tabla `students` no tiene una identidad única de alumno a nivel institución — cada materia crea su propio registro independiente para "el mismo" alumno. Consecuencias: si se edita el correo/nombre del alumno en una materia, no se actualiza en la otra; el historial académico queda fragmentado por materia en vez de unificado por persona. **Esto requiere una decisión de arquitectura** (¿una tabla `students` global + tabla de inscripciones por materia?, o es this el diseño intencional?) antes de decidir el cambio — no es un simple ajuste de UI.

  Nota menor de paso: el campo `nombres` guardó "Juan " (con espacio al final) en el registro viejo vs "Juan" (sin espacio) en el nuevo — falta un `.trim()` al guardar.

**Modal "Importación Inteligente" (botón sparkle, subida vía Gemini):**
- **Badge "MOTOR GEMINI 2.5 FLASH" no debería mostrarse al usuario** — expone un detalle técnico de implementación (nombre/versión del modelo de IA) que no le aporta nada al docente y queda obsoleto en cuanto cambien de modelo.
- **Texto redundante**: el título "Importación Inteligente" + subtítulo ya explican la acción ("Sube tu documento oficial en PDF, Imagen o Excel..."), y el dropzone repite lo mismo con su propio título "Seleccionar Prelista o Archivo" + otro subtítulo. Dos capas de título+descripción para una sola acción simple — se siente inflado de texto.
- **Botón de sparkle solitario debajo del dropzone, sin texto ni contexto claro** — se ve huérfano, no queda claro qué hace ni cuándo se activa.
- **Propuesta**: simplificar a un solo título + un dropzone con su texto, quitar la badge del modelo y el botón suelto (o darle propósito/label claro si hace algo).

### Pase de Lista (2026-09-14, sesión de retoma)

Se probó `/panel/materias/[id]/alumnos/asistencia` con los 8 alumnos de la materia QA, marcando estatus mixto (presente/falta/retardo) para cubrir los 3 estados.
- ✅ Interacción de marcado funciona bien: fondo de fila coloreado (verde/rojo/amarillo) da feedback visual inmediato y claro por alumno.
- 🔴 **Causa raíz confirmada — `alert()` nativo del navegador usado como mensaje de éxito**: en [`useAsistencia.ts:284`](../app/(docente)/panel/materias/[id]/alumnos/asistencia/_hooks/useAsistencia.ts) el guardado exitoso dispara `alert("Asistencia Guardada")` — un diálogo nativo del navegador/SO, no un componente de la UI. Esto explica el comportamiento que parecía "colgado": un `alert()` nativo **bloquea el hilo de JavaScript de la página** hasta que se hace clic en "Aceptar" manualmente (confirmado: la pestaña dejó de responder a cualquier interacción automatizada — "script injection timed out" — hasta que se cerró el diálogo). No hay pérdida de datos: el guardado sí se completa correctamente en el backend antes de mostrar el alert.
  - **Mismo patrón repetido 4 veces más en el mismo archivo**: `alert("Error al guardar GPS.")` (línea 185), `alert("Configura el GPS primero.")` (241), `alert("Error al iniciar radar.")` (254), y el catch genérico de guardar asistencia (286). Los 5 casos deberían reemplazarse por un banner/toast propio de la UI (como los que ya usa el resto de la app, ej. `#fee2e2`/`#dcfce7`) en vez de diálogos nativos — rompen la paleta institucional y bloquean la interacción de forma innecesaria.
  - Nota aparte: tras cerrar uno de estos `alert()` bloqueados, la sesión apareció expirada (regresó a login) — posible coincidencia de timing con la expiración normal del JWT durante el bloqueo prolongado, no confirmado como causado por el alert en sí.

**✅ Validado — flujo de QR de auto-registro + Historial multi-sesión**: se generó un QR desde Pase de Lista (Sesión 2), se configuró el área GPS (con un error de ubicación de prueba ya corregido por el usuario) y se escaneó desde un teléfono real como alumno (`Candelero Juan Antonio`). Se abrió también en escritorio la URL de validación (`/asistencia/validar/[id]?sig=...`) para revisar diseño — pantalla limpia, header navy institucional, íconos de escudo/alerta coherentes, sin el problema de paleta genérica visto en otras pantallas (aunque solo se alcanzó a ver el estado "Acceso Expirado" por timing, no el de éxito). En **Historial de Asistencia** se confirmó que:
- Las sesiones 1 (manual) y 2 (QR) aparecen como columnas independientes (14/09 S1, 14/09 S2) sin mezclarse.
- Solo Candelero Juan Antonio quedó en verde (✓) en S2 — el único que efectivamente escaneó el QR — el resto quedó en falta (✗), demostrando que el auto-registro por QR marca individualmente y no contamina a otros alumnos.
- El % de asistencia por alumno se recalcula correctamente combinando ambas sesiones (ej. Candelero: 1 de 2 = 50%).

**⚠️ Acción sensible casi disparada por accidente — botón "Sellar Asistencia U[n]"**: en la esquina superior derecha de Historial hay un botón con ícono de candado que a primera vista parece un simple toggle de UI, pero en realidad ejecuta `cerrarUnidad()` ([`useHistorial.ts:134`](../app/(docente)/panel/materias/[id]/alumnos/historial/_hooks/useHistorial.ts)): sella la unidad completa (`is_closed: true`), calcula porcentajes finales y sincroniza con Sheets — **acción irreversible** según su propio texto de confirmación. Por suerte antes de ejecutarse muestra un `confirm()` nativo del navegador ("Esta acción no se puede deshacer") que el usuario canceló a tiempo; no se selló nada. Aun así, es un hallazgo de diseño: un ícono de candado sin más contexto visual invita a pensar que es reversible/inofensivo cuando no lo es — convendría un ícono/color más distintivo (ej. advertencia) o exigir un paso adicional de confirmación dentro de la propia UI en vez de depender solo de un `confirm()` del navegador (mismo antipatrón de diálogos nativos que los `alert()` ya documentados).

**Modal "Editar Asistencia" (`EditAttendanceModal.tsx`)**:
- 🔴 Mismo patrón de cierre redundante ya señalado en otros modales: tiene una "X" en la esquina superior derecha (línea 48-53) **y además** un botón "Cancelar" separado abajo (línea 93-100) — ambos hacen exactamente lo mismo. Debe quedar solo la X.
- 🔴 El selector de "Justificante (PDF/imagen)" es un `<input type="file">` nativo sin ningún estilo (línea 79-84) — se ve como un control crudo del navegador en inglés ("Choose File / No file chosen"), rompiendo con el resto de la app que ya tiene un patrón de dropzone estilizado (el mismo de "Importación Inteligente"). Debería reusar ese componente.
- ✅ Los 3 botones de estatus (Asistió/Retardo/Falta) están bien resueltos: el que está seleccionado queda expandido con texto (verde/ámbar/rojo semánticos, no la paleta de marca — correcto, son colores de estado no de marca), los demás colapsan a solo ícono hasta hover. Buen patrón, no requiere cambios.

**Tabla de Historial (`AttendanceTable.tsx`)**:
- 🔴 **Baja affordance de que las celdas de asistencia son clickeables**: cada celda es un `<button>` sin fondo ni borde (`background: none, border: none`, línea 65), con solo un `title` de tooltip nativo del navegador como única pista. No hay hover, ni cursor distintivo más allá del ícono mismo. Un docente puede no descubrir nunca que puede corregir una asistencia pasada tocando ahí. Falta un hover/fondo sutil como affordance visual.
- 🔴 **Columnas "%" y "Examen" redundantes**: ambas comunican el mismo umbral del 80% (línea 76-80) — "%" ya se pinta rojo/verde según califica o no, y "Examen" repite la misma lógica con un badge "SÍ"/"NO" aparte. Información duplicada en dos columnas; podría combinarse en una sola.
- ✅ Columna "Alumno" fija (`position: sticky`) al hacer scroll horizontal en tablas con muchas fechas — buen detalle de UX.
- ✅ Colores de estatus (verde/ámbar/rojo) consistentes con Pase de Lista, sin el problema de paleta genérica (`#2563eb`) visto en otras pantallas.

### Paso 5 — Crear 2 actividades y 2 exámenes
_(pendiente de probar)_

### Paso 6 — Agregar a `j.candeleroc@gmail.com` como alumno
✅ Ya está en la materia QA desde antes (QA0003, ver arriba). Falta la validación real del lado alumno (fuera de esta sesión).

### Equipos de Trabajo — multi-equipo y mezcla de tamaños (2026-09-14, sesión de retoma)

**✅ Validado explícitamente a pedido del usuario**: se formaron una terna ("Terna QA-Norte": Chan Marina, Candelero Juan Antonio, Garcia Maria Fernanda) y un cuarteto ("Cuarteto QA-Sur": Beta Beto, Candelero Juan Antonio, Martinez Luis Angel, Perez Juan) reutilizando alumnos que ya estaban en los equipos previos (dupla "Equipo QA 1": Beta Beto + Pruebalo Ana). Se confirmó visualmente en el listado de "Equipos de Trabajo Conformados" que:
- **Beta Beto** aparece simultáneamente en "Equipo QA 1" (dupla) y "Cuarteto QA-Sur" (cuarteto).
- **Candelero Juan Antonio** aparece simultáneamente en "Cuarteto QA-Sur" y "Terna QA-Norte".

Confirma que un alumno **sí puede pertenecer a varios equipos de distinto tamaño a la vez** (dupla, terna, cuarteto) sin error ni bloqueo — comportamiento correcto. Importante: esto es exclusivo por materia (cada equipo vive bajo el `course_id` de la materia actual, igual que los alumnos) — no hay manera hoy de que un equipo de otra materia interfiera con estos, pero tampoco hay forma de reutilizar/ver equipos entre materias (mismo problema de fondo que la duplicación de alumnos ya documentada).

**Revisión de diseño — pantalla Equipos (`TeamsGrid.tsx`)**:
- ✅ "Editar"/"Eliminar" de cada card de equipo ya son `ExpandingButton` (ícono, texto en hover) — cumple la regla de diseño acordada.
- ✅ El ícono "quitar del equipo" (`UserMinus`) junto a cada integrante es un botón funcional real con tooltip, correctamente solo-ícono sin texto (acción ya autoexplicativa + tooltip).
- 🔴 **Hallazgo de paleta, sistémico**: el badge de ícono circular (`backgroundColor: "#eff6ff", color: "#2563eb"`) se repite en el header del acordeón "Equipos de Trabajo Conformados" y en cada card de equipo — es el mismo azul genérico ya señalado en el modal de Importación Inteligente. Pero aquí no tiene nada que ver con IA (son equipos de trabajo comunes), lo que confirma que **no es un problema aislado de "estilo IA" en un modal**, sino que ese azul (`#2563eb`/`#eff6ff`) se usa como color de acento secundario en toda la aplicación, en vez de la paleta navy/dorado institucional. Tratar como un solo hallazgo de paleta a nivel de sistema de diseño, no repetirlo pantalla por pantalla.
