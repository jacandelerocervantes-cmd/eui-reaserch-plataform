# Migración de Apps Script a llamadas directas a las APIs de Google

**Estado: NO EJECUTAR TODAVÍA.** Este documento es un plan de referencia para cuando
se decida hacer la migración — no es una tarea pendiente activa. Mientras tanto, EUI
sigue operando sobre `appscript/` sin cambios.

## 1. Por qué existe este documento

Hoy, todo lo que EUI necesita de Google (correo, calendario, tareas, Sheets, Drive,
Slides, Forms) pasa por un único webapp de Apps Script (`appscript/Router.gs`), al que
las Edge Functions de Supabase llaman por HTTPS con un secreto compartido
(`WEBHOOK_SECRET` / `APPS_SCRIPT_SECRET`). Es una arquitectura válida y ya funciona.
El día que se vuelva un cuello de botella (cuotas, latencia, límite de 6 minutos por
ejecución de Apps Script, o necesidad de mejor observabilidad/logs), este documento
evita tener que re-descubrir desde cero qué reemplaza a qué.

## 2. Dato clave que cambia el cálculo: no hace falta un service account nuevo

La app ya autentica usuarios con Google vía Supabase Auth
(`lib/supabase.ts` → `signInWithGoogle()`). Si en ese login se piden los scopes
correctos desde el principio, Supabase ya entrega un `provider_token` /
`provider_refresh_token` de Google **por usuario**, utilizable para llamar las APIs de
Google directamente — sin necesidad de un service account de dominio ni de
domain-wide delegation. Esto simplifica bastante la migración comparado con partir de
cero.

## 3. Sobre la verificación de Google — aclaración importante

**No depende de Apps Script vs. API directa.** Depende de:
- Qué *scopes* se piden (los "sensibles" o "restringidos" — enviar Gmail en nombre del
  usuario, acceso amplio a Drive — requieren revisión).
- Cuántos usuarios tiene la app (el modo "Testing" en Google Cloud Console permite
  ~100 usuarios de prueba sin revisión; pasar de ahí, la requiere).

O sea: la revisión de Google va a tocar tarde o temprano si TecNM Tizimín crece más
allá de modo prueba, sea con Apps Script o con API directa. Migrar antes no la evita
ni la acelera — solo cambia qué motor ejecuta las llamadas.

## 4. Mapa de reemplazo, archivo por archivo

| Archivo `.gs` actual | Servicio de Apps Script usado | API de Google que lo reemplaza | Scope de OAuth necesario |
|---|---|---|---|
| `Service_Gmail.gs`, y el envío en `Router.gs` (`enviarCorreoInvitacion`) | `GmailApp` | Gmail API (`users.messages.send`) | `gmail.send` |
| `Service_Calendar.gs`, `Service_Citas.gs`, `Service_Schedule.gs` | `CalendarApp` | Calendar API (`events.insert/list/update`) | `calendar.events` o `calendar` |
| `Service_Tasks.gs` | `Tasks.Tasklists`, `Tasks.Tasks` | Tasks API (ya es REST — Apps Script solo la envuelve, la migración más directa de todas) | `tasks` |
| `Serice_Alumnos.gs`, `Service_Asistencia.gs`, `Service_Calificaciones.gs`, `Service_Tablon.gs` | `SpreadsheetApp` | Sheets API (`spreadsheets.values.*`) | `spreadsheets` |
| `Service_Materias.gs`, `Service_workspace.gs` | `DriveApp`, `SlidesApp`, `SpreadsheetApp` | Drive API + Slides API + Sheets API | `drive.file` (preferible a `drive` completo — más fácil de verificar), `presentations` |
| `servicio_evaluaciones.gs` | `FormApp` | Forms API | `forms.body` |

## 5. Orden recomendado de migración (cuando se decida hacerla)

De menor a mayor riesgo/esfuerzo:

1. **`Service_Tasks.gs`** — ya es la envoltura más delgada sobre una API REST. Buen
   primer caso de prueba para validar el flujo de token-por-usuario antes de tocar algo
   más crítico.
2. **`Service_Calendar.gs` / `Service_Citas.gs` / `Service_Schedule.gs`** — Calendar API
   es madura y bien documentada.
3. **`Service_Gmail.gs`** — mayor cuidado: `gmail.send` es scope sensible, y los
   límites de envío de Gmail API son distintos a los de `GmailApp` (cuota diaria).
4. **Sheets (`Serice_Alumnos.gs`, `Service_Asistencia.gs`, `Service_Calificaciones.gs`,
   `Service_Tablon.gs`)** — volumen alto de llamadas, conviene batch requests de Sheets
   API en vez de escrituras una por una.
5. **Drive/Slides/Forms (`Service_Materias.gs`, `Service_workspace.gs`,
   `servicio_evaluaciones.gs`)** — las más complejas (creación de carpetas, permisos,
   plantillas). Dejar para el final.

Durante la transición, mantener `Router.gs` como *fallback*: migrar servicio por
servicio, no de golpe, y solo apagar la ruta de Apps Script de un servicio cuando su
reemplazo directo ya esté verificado en producción.

## 6. Señales de que ya es momento de migrar (no antes)

- Se empieza a golpear cuotas de Apps Script (ej. límite de ejecuciones/día o de envío
  de Gmail vía `GmailApp`).
- Alguna operación necesita más de 6 minutos (límite duro de ejecución de Apps Script).
- Se necesita logging/observabilidad real (Apps Script no da buenas trazas de error en
  producción).
- La cantidad de usuarios activos obliga de todos modos a pasar por la verificación de
  Google — en ese momento, aprovechar y decidir con qué motor se queda.

## 7. Lo que NO cambia con esta migración

El contrato hacia el frontend (`supabase.functions.invoke('inicio-bridge', ...)`, etc.)
no tiene que cambiar. La migración es un cambio interno de la Edge Function o de una
nueva Edge Function que reemplace la llamada a `Router.gs` por una llamada directa a la
API de Google correspondiente — el resto de la app (React, RLS, Supabase) no se entera.
