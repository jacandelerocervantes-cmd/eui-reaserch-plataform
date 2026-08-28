# Auditoría de Seguridad — Seguimiento

Basado en la lista de 20 puntos de `mds/02_Ciberseguridad_Hibrida.md`. Se
actualiza según se van resolviendo puntos. Última actualización: 2026-08-23
(CORRE 4 — `MDS INSTRUCCIONES/CORRE 4 - 03_Ciberseguridad_Hibrida.md`).

## Acciones pendientes que requieren que TÚ las hagas

Estas no las puedo ejecutar yo (credenciales, dashboards externos, decisiones
de infraestructura):

- [ ] **Correr la migración SQL** `supabase/migrations/20260820000000_attendance_hmac_rate_limit.sql`
      en el SQL Editor de Supabase (agrega columna `source`, tabla de rate
      limit y su función).
- [ ] **Definir `PROFILE_ENCRYPTION_KEY`** (generarlo con `openssl rand -hex 32`,
      32 bytes en hex): variable de entorno del servidor Next.js en Vercel
      (**sin** prefijo `NEXT_PUBLIC_`). Necesaria para que `/api/profile/zotero-key`
      pueda cifrar/descifrar. Si ya hay usuarios con `zotero_api_key` guardada
      en texto plano en `profiles`, la migración a cifrado es automática y
      perezosa (se re-cifra sola la primera vez que ese usuario abre
      Ajustes del Investigador) — no hace falta correr nada a mano.
- [ ] **Definir `QR_HMAC_SECRET`** (mismo valor en ambos lugares, generarlo con
      `openssl rand -hex 32`):
  - Variables de entorno del servidor Next.js en Vercel (**sin** prefijo
    `NEXT_PUBLIC_`).
  - Secret de la Edge Function: `supabase secrets set QR_HMAC_SECRET=...`
- [x] **`_shared/auth.ts` y `_shared/gemini.ts` — RESUELTO, esta nota estaba
      desactualizada.** Confirmado en el doble check de
      `mds/05_A_DoubleCheck_QA_Tecnico.md` (ver
      `qa-05a-doublecheck/01-REPORTE.md`, 2026-08-21): ambos archivos
      existen en `supabase/functions/_shared/` de este mismo checkout, con
      `verifyUser`, `verifyDocente`, `verifyCourseOwnership` exportados tal
      como se citan abajo. La especulación sobre un "hueco de esta copia
      local" no aplicaba ya para cuando se escribió — quedó sin actualizar
      tras resolverse. Ya no hace falta el paso de verificación manual en
      producción que se describía aquí.
- [ ] **Decisión de arquitectura (punto 1):** qué vive on-premise en Tizimín
      vs. nube pública. Hoy todo está en Supabase cloud — no hay nada que
      migrar hasta que definas qué dato/proceso específico necesita quedarse
      local y por qué (¿regulatorio? ¿latencia? ¿costo?). Ver "Requisitos
      para migrar a BD física en Tizimín" más abajo — documentado pero no
      implementado, a la espera de esa decisión.
- [ ] **Verificar historial de Git remoto (punto 3):** el snapshot local no
      tiene `.git`, así que no pude auditar si hubo secretos commiteados
      alguna vez en el repo real. Si existe un remoto, correr algo como
      `git log -p --all | grep -i -E "service_role|api[_-]?key|secret"`
      sobre él (o usar `gitleaks`/`trufflehog`) antes de darlo por limpio.
      (Reconfirmado 2026-08-23, CORRE 4: sigue sin repo Git en ningún nivel
      de este checkout — mismo hueco, no reauditable desde aquí.)
- [ ] **Correr la migración** `supabase/pendiente/012_custody_events.sql`
      (nueva, CORRE 4) en el SQL Editor de Supabase: crea la tabla
      `custody_events` (cadena de hashes SHA-256 append-only) y las
      funciones `append_custody_event`/`verify_custody_chain`. Ver punto 5
      más abajo y `supabase/pendiente/README.md` sección 8 para el detalle
      y el smoke test manual.

## Investigación: carpeta `_shared/` — RESUELTO, ya no falta

**Nota 2026-08-21:** esta sección quedó desactualizada — describía una
carpeta `_shared/` ausente que, para cuando se escribió, ya existía en este
mismo checkout (`supabase/functions/_shared/auth.ts`, `gemini.ts`,
`fileValidation.ts`, `kalman.ts`, `kalmanStore.ts`, etc.). Se deja el
análisis original abajo solo como referencia histórica de la causa raíz que
se investigó, por si vuelve a faltar en otra copia/export del repo — pero no
hay acción pendiente aquí.

<details>
<summary>Análisis original (histórico, ya no aplica a este checkout)</summary>

Causa raíz más probable (confirmada localmente hasta donde se puede):
`eui-reaserch-plataform-main/.gitignore:45` tiene la línea `supabase/` — es
decir, **toda** la carpeta `supabase/` (funciones, migraciones, `_shared/`)
está excluida de git en este proyecto. Eso significa que el código de las
Edge Functions probablemente se despliega manualmente vía
`supabase functions deploy` desde la máquina de quien lo mantiene, en vez de
ir empaquetado con el repo de Next.js/Vercel. Si en algún export/copia futura
`_shared/` volviera a faltar (por copiar solo los `index.ts` de cada función
y no sus dependencias compartidas), este sería el primer lugar a revisar.

</details>

## Requisitos para activar protección perimetral (Cloudflare) — documentado, no implementado

Punto 11 del checklist. Esto es configuración externa (DNS/CDN) — no hay
código de la app que yo pueda tocar para resolverlo; necesita que actives
una cuenta y cambies el DNS del dominio, algo que solo tú puedes hacer.

**1. Requisito previo:** el dominio de producción tiene que estar en
Cloudflare (plan gratuito alcanza) — hoy Vercel probablemente maneja el DNS
directo. Mover el DNS a Cloudflare implica un cambio de nameservers en el
registrador del dominio (puede tardar horas en propagar) — hazlo en una
ventana de bajo tráfico, no a media clase.

**2. Configuración una vez el dominio está en Cloudflare:**
- Activar el proxy (nube naranja) en el registro DNS que apunta a Vercel —
  así el tráfico pasa primero por el edge de Cloudflare antes de llegar a
  la app.
- **Bot Fight Mode** (gratis): bloquea bots conocidos automáticamente, sin
  configuración fina.
- **Regla de WAF gratuita** para el endpoint más expuesto —
  `/asistencia/validar/*` es público y sin sesión (es la superficie que más
  se beneficia de esto): limitar solicitudes por IP, ej. 20 req/min.
- **"I'm Under Attack Mode"**: palanca de emergencia manual para activar
  durante un ataque activo (agrega un challenge JS antes de servir
  cualquier página) — no se deja prendida por default porque afecta la UX.

**3. Qué NO reemplaza:** Cloudflare protege la capa de red/DNS (volumen de
tráfico, bots masivos), no sustituye el rate limiting a nivel de aplicación
que ya se agregó en `register-attendance` (punto 15) — son capas
complementarias, no una en lugar de la otra.

**4. Alternativa mínima sin salir de Vercel:** Vercel ya incluye mitigación
básica de DDoS a nivel de plataforma en todos los planes (incluido el
gratuito) — no es configurable ni tan robusto como Cloudflare, pero es una
base mejor que nada mientras se decide si vale la pena el cambio de DNS.

## Requisitos para migrar a BD física en Tizimín (documentado, no implementado)

Esto es lo que haría falta para sacar la BD de Supabase cloud y correrla en
un servidor físico en Tizimín, **si en algún momento se decide hacerlo**. No
se implementó nada de esto — es la lista de qué se necesitaría resolver
antes de empezar, para que la decisión se tome con el costo real sobre la
mesa.

**1. Hardware y energía**
- Un servidor físico dedicado (no una laptop/PC de uso general) con disco
  redundante (RAID 1 mínimo) — un disco que falla sin redundancia es pérdida
  total de datos, no un incidente.
- UPS (batería de respaldo) dimensionado para al menos 30-60 min de autonomía
  — sin esto, cualquier corte de luz local tira la BD (y potencialmente
  corrompe datos a medio escribir).
- Idealmente un plan de respaldo eléctrico más largo (generador) si el
  servicio no puede tener downtime durante apagones prolongados, comunes
  fuera de zonas metropolitanas.

**2. Conectividad y exposición segura**
- La app (Next.js en Vercel) necesita llegar a la BD desde internet — pero
  el servidor en Tizimín normalmente no tiene IP pública fija ni fibra
  simétrica. Opciones reales:
  - **VPN punto a punto** (WireGuard/Tailscale) entre Vercel y el servidor —
    la única opción que no expone Postgres directo a internet.
  - Si no hay forma de correr un túnel permanente, un **DNS dinámico** +
    firewall con allowlist de IPs de Vercel — mucho más frágil, no
    recomendado para datos sensibles.
- Ancho de banda de subida (upload) suficiente y estable — es el cuello de
  botella típico de conexiones residenciales/comerciales fuera de hubs
  grandes; hay que medirlo antes, no asumirlo.

**3. Postgres self-hosted**
- Instalar y mantener Postgres (o Supabase self-hosted vía Docker, que
  replica el stack actual — Auth, PostgREST, Realtime — sobre hardware
  propio) en vez de depender del servicio administrado.
- TLS/certificados propios para las conexiones (hoy Supabase lo maneja
  automáticamente).
- Sin el equipo de Supabase administrando parches de seguridad y versiones
  de Postgres, alguien en el proyecto asume ese trabajo de forma continua.

**4. Backups y continuidad**
- Backups automáticos **fuera del sitio** (no solo en el mismo servidor —
  si el servidor se daña físicamente, un backup local no sirve de nada).
  Esto implica subir backups cifrados a algún storage en la nube, lo cual es
  un poco irónico dado el objetivo de sacar datos de la nube, pero es
  indispensable.
- Plan de recuperación ante desastre probado (no solo "tenemos backups" —
  hay que haber restaurado uno alguna vez para confiar en que funciona).
- Monitoreo/alertas de que el servidor sigue vivo (uptime, espacio en
  disco, CPU) — hoy Supabase lo da gratis; self-hosted hay que montarlo
  (ej. Uptime Kuma, que es gratuito y frugal).

**5. Migración de datos y corte**
- Definir con precisión qué tablas se mueven (candidatas: `students`,
  `validated_attendances`, cualquier dato con matrícula/correo/geolocalización)
  vs. qué se queda en la nube (lo que no es sensible y sí necesita alta
  disponibilidad, ej. contenido de `materiales_boveda`).
- Estrategia de corte: ¿migración con downtime programado (más simple, más
  fricción para usuarios) o dual-write temporal (más complejo, cero
  downtime)? Para un proyecto de este tamaño, downtime programado en horario
  de baja actividad es razonable.
- Actualizar RLS y las policies actuales — están escritas para PostgREST de
  Supabase; self-hosted Supabase las conserva, pero un Postgres "pelón" sin
  PostgREST/GoTrue requeriría reescribir toda la capa de autorización que
  hoy vive en RLS + Supabase Auth.

**6. Costo real vs. la razón para migrar**
- Antes de migrar, vale comparar el costo real (hardware + energía +
  tiempo de alguien manteniéndolo) contra el costo actual de Supabase cloud
  — "Ingeniería Frugal" a veces significa quedarse en lo administrado
  porque mantener infraestructura propia cuesta más en tiempo humano que en
  dinero. Esto solo tiene sentido si hay una razón concreta (regulatoria,
  de soberanía del dato, o de conectividad) que lo justifique — no como
  costo-beneficio económico puro.

## Checklist de 20 puntos

### A. Aislamiento Híbrido y Protección de Datos
| # | Punto | Estado |
|---|---|---|
| 1 | On-Premise Tizimín vs nube | 🔴 Pendiente — requiere decisión tuya, ver arriba |
| 2 | Ocultamiento API Keys | 🟢 Resuelto |
| 3 | Purga de secretos en Git | 🟡 Parcial — `.gitignore` correcto, historial remoto no auditado |
| 4 | Encriptación de datos sensibles | 🟡 Parcial — `zotero_api_key` cifrada (2026-08-20); matrícula/correo/geolocalización siguen en texto plano (ver nota) |
| 5 | Gestión de credenciales de BD | 🟢 Resuelto |
| — | Trazabilidad criptográfica (custodia, punto 5 de CORRE 4) | 🟡 Parcial — código final listo (`supabase/pendiente/012_custody_events.sql` + `lib/server/custody.ts`, probado), migración **sin ejecutar aún**; no había ninguna cadena de hashes antes de esto (ver `auditoria/custody_audit.py`) |

### B. Redes, APIs y Webhooks
| # | Punto | Estado |
|---|---|---|
| 6 | HMAC en webhooks | 🟢 Resuelto — `register-attendance` + `app/api/attendance/session` (2026-08-20) |
| 7 | Forzado HTTPS | 🟢 Resuelto — HSTS agregado junto con el punto 8 (2026-08-20) |
| 8 | Cabeceras de seguridad | 🟢 Resuelto — CSP con nonce + strict-dynamic, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (2026-08-20) |
| 9 | Recorte de respuestas API | 🟡 Parcial |
| 10 | Escaneo de dependencias | 🟢 Resuelto — Next.js 16.1.6→16.3.1, `npm audit fix`, 0 vulnerabilidades; gate `npm audit --audit-level=high` agregado a CI (2026-08-20) |
| 11 | Protección perimetral (Cloudflare/DDoS) | 🔴 Pendiente — requiere cambio de DNS, ver requisitos documentados (2026-08-20) |

### C. Hardening de Autenticación y BD
| # | Punto | Estado |
|---|---|---|
| 12 | Auth server-side | 🟢 Resuelto |
| 13 | Cookies de sesión seguras | 🟢 Resuelto |
| 14 | Contraseñas hasheadas | 🟢 N/A — solo OAuth Google |
| 15 | Rate limiting en auth | 🟢 Resuelto para `register-attendance` (2026-08-20). Resto de endpoints sin revisar. |
| 16 | Bloqueo manipulación de registros (IDOR) | 🟡 Parcial — bug en `horarios_docente` ya corregido; trazabilidad `source` agregada a `validated_attendances` (2026-08-20); resto de tablas no auditadas una por una |
| 17 | Inyección SQL | 🟢 Resuelto |
| 18 | RLS | 🟡 Parcial — doble check `05_A` (2026-08-21) encontró 2 policies `using(true)`/`check(true)` públicas no cubiertas por esta auditoría (`perfiles.matricula_rfc` legible sin sesión, `telemetria_iot` insert/select públicos). Fix en `supabase/pendiente/006_rls_hardening_kalman_version.sql`, **sin ejecutar aún** — ver `qa-05a-doublecheck/02-SOLUCION.md`. Segunda ronda (2026-08-23, `qa-05a-doublecheck-02`) encontró una tercera policy pública del mismo tipo (`equipos_lab` SELECT sin sesión) que la primera ronda no había cubierto — fix en `supabase/pendiente/007_rls_equipos_lab.sql`, **sin ejecutar aún** — ver `qa-05a-doublecheck-02/02-SOLUCION.md`. **Barrido exhaustivo adicional (2026-08-23, CORRE 4):** `grep` de `using(true)`/`check(true)` sobre TODO `supabase/` (`migrations/`, `pendiente/`) encontró 6 coincidencias en total — las 4 ya cubiertas por 006/007 (`perfiles`, `telemetria_iot` ×2, `equipos_lab`) y 2 más sobre `horarios_docente` (`"Acceso total"`, `"Permitir todo a usuarios autenticados"`, ambas `FOR ALL TO public USING (true)`) que **ya estaban corregidas por una migración previa** (`supabase/migrations/20260816053309_add_access_level_fix_horarios_rls.sql`, hace `DROP POLICY` de ambas) — no es un hallazgo nuevo, es la confirmación de que el punto 16 ("bug en horarios_docente ya corregido") sí cubre esto. **No se encontraron policies públicas adicionales sin cubrir.** Queda pendiente de tu parte confirmar que esa migración de `horarios_docente` y las 2 de `supabase/pendiente/` (006, 007) ya corrieron en el proyecto real (no solo en este checkout). |

### D. Validación Rigurosa
| # | Punto | Estado |
|---|---|---|
| 19 | Sanitización XSS | 🟢 Resuelto |
| 20 | Validación por Magic Bytes | 🟢 Resuelto (2026-08-20 Edge Functions + gap de Storage cerrado en código antes del 2026-08-23, confirmado y con tests agregados en CORRE 4) — ver nota actualizada abajo |

## Cambios ya aplicados (código)

**2026-08-23 — CORRE 4 (`03_Ciberseguridad_Hibrida.md`), ejecución completa:**
- **Corrección de documentación (punto 20):** esta misma tabla marcaba el
  punto 20 como "🟡 Parcial" describiendo como gap abierto que las subidas
  directas del navegador a Storage (`JUSTIFICANTES`, `campo-capturas`) no
  tenían validación server-side. Verificado que **eso ya no es cierto en el
  código actual** — existe `app/api/storage/validated-upload/route.ts` +
  `lib/uploadValidated.ts` + `lib/server/fileValidationServer.ts` (de una
  sesión anterior a esta, sin fecha propia registrada), y los 3 flujos que
  antes subían directo (`useCaptura.ts`, `useHistorial.ts`,
  `useBitacoraLaboratorio.ts`) ya usan `uploadValidated()`. La tabla se
  corrigió a 🟢 Resuelto; no se tocó código de ese endpoint, solo se agregó
  el test que faltaba (ver abajo).
- **Tests de magic bytes agregados (faltaban, exigidos por CORRE 4):**
  `lib/server/fileValidationServer.test.ts` (nuevo) y
  `supabase/functions/_shared/fileValidation.test.ts` (nuevo) — usan firmas
  binarias reales (no simuladas) para PDF/PNG/ZIP/OLE/JPG/MZ/ELF y
  confirman que una extensión falsa (ej. `.pdf` con contenido PNG real, o un
  ejecutable MZ/ELF disfrazado de `.pdf`/`.png`) es rechazada por
  `validateFileBytesByExtension`/`validateFileBytes` sin modificar esa
  lógica.
- **Test HMAC agregado (faltaba, exigido por CORRE 4):**
  `supabase/functions/_shared/hmac.ts` (nuevo) extrae `hmacHex`/
  `timingSafeEqualHex`/`isValidQrSignature` que antes vivían duplicadas
  inline en `register-attendance/index.ts` — mismo comportamiento, ahora
  importado desde un solo lugar. `supabase/functions/_shared/hmac.test.ts`
  (nuevo) ejecuta esa función real y confirma que una firma con secreto
  incorrecto, para otro hash, o manipulada un carácter, es rechazada; y que
  la firma correcta sí se acepta. Verificado con `deno check` (tipos
  limpios) sobre `register-attendance/index.ts` y `_shared/hmac.ts` —
  `deno lint` reporta 2 avisos preexistentes de estilo de import
  (`https://deno.land/...`) que ya estaban ahí antes de este cambio, no
  introducidos por él.
- **Barrido RLS exhaustivo (punto 18):** `grep` de `using(true)`/
  `check(true)` sobre todo `supabase/` — 6 coincidencias, todas ya
  cubiertas (4 por `006`/`007`, 2 de `horarios_docente` ya resueltas por
  `20260816053309_add_access_level_fix_horarios_rls.sql`). Sin hallazgos
  nuevos — ver detalle en la fila del punto 18 más abajo.
- **Cadena de custodia (punto 5, nuevo):** `supabase/pendiente/
  012_custody_events.sql` (nuevo) — tabla `custody_events` append-only +
  `canonical_json`/`append_custody_event`/`verify_custody_chain`, con RLS
  (solo lectura autenticada, sin policy de escritura directa). `lib/server/
  custody.ts` (nuevo) — espejo en TypeScript de la misma lógica (hash chain
  + Merkle tree) para poder probarla sin depender de la migración ya
  ejecutada. **No se implementó Merkle como mecanismo activo** — se
  implementó y probó el módulo por completitud (lo exige la letra de
  CORRE 4), pero se sigue la recomendación de `auditoria/custody_audit.py`
  de no desplegarlo hasta que exista un caso de uso de anclaje externo.
- Verificado: `npx vitest run` → **43/43 tests pasan** (7 archivos, incluidos
  los 4 nuevos: `hmac.test.ts`, `fileValidation.test.ts`,
  `fileValidationServer.test.ts`, `custody.test.ts`); `npx tsc --noEmit`
  limpio.

**2026-08-23 — Punto 18, segunda ronda de doble check (`qa-05a-doublecheck-02`),
pasada profunda de Módulo 02:** grep exhaustivo de `using(true)`/`check(true)`
sobre TODOS los `.sql` de `supabase/` (no solo las tablas que ya se habían
tocado) encontró una tercera policy pública sin cubrir: `equipos_lab`
(`SELECT ... TO public USING (true)`) — cualquiera con la anon key podía leer
el inventario de equipo de laboratorio sin sesión vía REST directo. Fix:
`supabase/pendiente/007_rls_equipos_lab.sql` (nuevo) — cierra la policy a rol
`authenticated`, mismo patrón que 006. **Pendiente de ejecutar** en el SQL
Editor — ver `supabase/pendiente/README.md` punto 7. Ver
`qa-05a-doublecheck-02/01-REPORTE.md` y `02-SOLUCION.md` para el detalle
completo de esta segunda ronda (incluye verificación de que los 10 puntos de
la primera ronda siguen resueltos en el código actual).

**2026-08-21 — Punto 18 (RLS pública en `perfiles`/`telemetria_iot`), doble check Módulo 05_A:**
- Hallazgo: `perfiles` (`SELECT ... TO public USING (true)`) exponía
  `matricula_rfc` (PII fiscal) a cualquiera con la anon key, sin sesión, vía
  REST directo. `telemetria_iot` tenía `INSERT`/`SELECT` igual de abiertos.
  Ninguna de las dos policies estaba cubierta por el checklist de 20 puntos
  original. Ver detalle completo en `qa-05a-doublecheck/01-REPORTE.md` y
  `qa-05a-doublecheck/02-SOLUCION.md`.
- `supabase/pendiente/006_rls_hardening_kalman_version.sql` (nuevo) —
  cierra ambas policies a rol `authenticated` (`perfiles` además scoped a
  `auth.uid() = id`). **Pendiente de ejecutar** en el SQL Editor — ver
  `supabase/pendiente/README.md` punto 6.
- No se tocó código de la app: ningún archivo de `app/`/`lib/` consulta la
  tabla `perfiles` (tabla legacy, reemplazada en la práctica por
  `profiles`+`students`), así que el fix es puramente de política RLS.

**2026-08-21 — Punto 3 del doble check Módulo 05_A (Kalman: sin mínimo de
observaciones, condición de carrera en `kalmanStore.ts`):** no es un punto
del checklist de 20 de ciberseguridad, pero se corrigió en la misma sesión —
ver `qa-05a-doublecheck/02-SOLUCION.md` para el detalle (`kalmanStore.ts`
optimistic locking con columna `version`, `compute-student-risk-signals` y
`compute-research-trends` con guard `MIN_OBSERVATIONS`).

**2026-08-20 — Puntos 6, 15, 16 (flujo de asistencia QR):**
- `app/api/attendance/session/route.ts` (nuevo) — crea/rota sesión QR firmando el hash server-side.
- `supabase/functions/register-attendance/index.ts` — verifica firma HMAC, rate limiting, `source: 'qr_scan'`.
- `app/(docente).../asistencia/page.tsx` — usa la API firmada en vez de escribir la tabla directo; distingue `source` manual vs QR al sellar.
- `app/(publico)/asistencia/validar/[hash]/page.tsx` — envía `sig`, nuevos códigos de error `INVALID_SIGNATURE`/`RATE_LIMITED`.
- `supabase/migrations/20260820000000_attendance_hmac_rate_limit.sql` (nuevo, sin ejecutar aún).

**2026-08-20 — Punto 10 (dependencias):**
- `package.json` — `next` 16.1.6 → 16.3.1 (resuelve CVEs de Next.js, arrastra fix de `postcss`/`sharp`).
- `npm audit fix` — resolvió `tar`, `ws`, `brace-expansion`, `flatted`, `minimatch` (devDependencies).
- `.github/workflows/ci.yml` — agregado paso `npm audit --audit-level=high` antes del build.
- Verificado: `tsc --noEmit` limpio, `npm test` 3/3 pasan, `npm audit` → 0 vulnerabilidades.

**2026-08-20 — Puntos 7 y 8 (cabeceras de seguridad):**
- `proxy.ts` (el middleware del proyecto) ahora genera un nonce por request y
  aplica `Content-Security-Policy` (script-src con nonce + `strict-dynamic`,
  `frame-ancestors 'none'`, `connect-src` acotado al origen real de Supabase
  leído desde `NEXT_PUBLIC_SUPABASE_URL`, `img-src`/`connect-src` con Google
  Maps), `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`. Se aplica en todas las ramas de
  retorno del middleware, incluidos los redirects.
- `'unsafe-eval'` en `script-src` solo se agrega cuando `NODE_ENV !== 'production'`
  (lo necesita Turbopack/React en modo dev; nunca en build de producción).
- `style-src` usa `'unsafe-inline'` — la UI depende de `style={{...}}` inline
  en casi todas las páginas; llevarlo a nonce/hash sería una reescritura
  completa fuera de alcance de este pase.
- Probado en `next dev` (Turbopack) contra `/login` y `/asistencia/validar/[hash]`:
  sin violaciones de CSP en consola, cabecera `Content-Security-Policy`
  confirmada vía `fetch().headers`, `tsc --noEmit` limpio.
- Se creó `.claude/launch.json` en la raíz del repo (config para levantar
  `npm run dev` desde el subdirectorio del proyecto vía el navegador de
  Claude Code) — no es parte del código de la app, es tooling de desarrollo.

**2026-08-20 — Punto 20 (validación de archivos por Magic Bytes):**
- `supabase/functions/_shared/fileValidation.ts` (nuevo) — `sniffFileType()`
  lee las primeras firmas binarias (PDF, ZIP/Office, PNG/JPG/GIF, OLE,
  y ejecutables MZ/ELF/Mach-O) y `validateFileBytes()` las compara contra lo
  que el archivo dice ser.
- **Server-side real** (esto sí es un límite de seguridad, no solo UX):
  `supabase/functions/import-ia-students/index.ts` y
  `supabase/functions/intelligent-file-parser/index.ts` — ambas reciben los
  bytes crudos del archivo y ahora los validan antes de mandarlos a Gemini
  (antes confiaban ciegamente en `file.type`/nombre para decidir cómo
  procesar el archivo, incluyendo qué `mimeType` reportarle a la API de
  Gemini).
- **Client-side** (solo UX/fricción, NO es un límite de seguridad —
  ver advertencia en el archivo): `lib/fileValidation.ts` (nuevo), conectado
  en `FileZone.tsx` (entrega de tareas del alumno), `ImportModal.tsx`
  (importación de alumnos), `EditAttendanceModal.tsx` (justificantes de
  asistencia).
- **Gap que quedaba pendiente aquí — CERRADO en una sesión posterior, sin
  fecha propia registrada, confirmado 2026-08-23 en CORRE 4:** los archivos
  que subían directo a Supabase Storage desde el navegador (bucket
  `JUSTIFICANTES`, `campo-capturas` en `campo/captura` y
  `laboratorio/bitacora`) ahora pasan por
  `app/api/storage/validated-upload/route.ts` (vía `lib/uploadValidated.ts`),
  que valida los bytes reales con `lib/server/fileValidationServer.ts`
  antes de subir. Los 3 flujos (`useCaptura.ts`, `useHistorial.ts`,
  `useBitacoraLaboratorio.ts`) ya usan `uploadValidated()` en vez de llamar
  a Storage directo. Test agregado en CORRE 4:
  `lib/server/fileValidationServer.test.ts`.
- Verificado (2026-08-20): `tsc --noEmit` limpio, `npm test` 3/3 pasan.
  Re-verificado (2026-08-23, CORRE 4): `npx vitest run` → 43/43 pasan
  (incluye los tests nuevos de este punto).

**2026-08-20 — Punto 4 (encriptación de datos sensibles):**
- Hallazgo: la UI de `app/(investigacion)/investigacion/config/page.tsx`
  dice textualmente "Tus claves se guardan cifradas", pero
  `profiles.zotero_api_key` (una API key real de Zotero, credencial de
  terceros) se guardaba en texto plano — promesa falsa al usuario.
- `app/api/profile/zotero-key/route.ts` (nuevo) — cifra/descifra
  `zotero_api_key` con AES-256-GCM usando `PROFILE_ENCRYPTION_KEY` (secreto
  solo de servidor). El frontend ya no lee/escribe esa columna directo por
  el cliente Supabase; pasa por esta ruta.
- Migración de valores viejos en texto plano: automática y perezosa (al
  primer GET del usuario dueño de esa fila, sin acción manual).
- `lib/supabaseServer.ts` (nuevo) — extraje el helper de cliente Supabase
  server-side que ya usaba `app/api/attendance/session/route.ts`, para no
  duplicarlo en la nueva ruta.
- **No cubierto por este cambio:** matrícula, correo y geolocalización
  (`students`, `validated_attendances`, `capturas_campo`, etc.) siguen sin
  cifrar a nivel de columna — dependen solo del cifrado en reposo por
  defecto de la infraestructura de Supabase/AWS y de RLS. Cifrarlos
  también tendría un costo real: rompería `ilike`/búsquedas por matrícula
  y JOINs tal como están escritos hoy, así que decidí no tocarlos sin que
  definas si el costo se justifica para ese dato específico (no es lo
  mismo un correo institucional que una API key de terceros).
- Verificado: `tsc --noEmit` limpio, `npm test` 3/3 pasan.
