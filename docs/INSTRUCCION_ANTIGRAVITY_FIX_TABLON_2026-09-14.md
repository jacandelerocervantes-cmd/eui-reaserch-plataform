# Instrucción para Antigravity — Corregir 2 hallazgos de la auditoría de Comentarios en Tablón

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Contexto:** auditoría de la tarea anterior (comentarios en Tablón) encontró 2 problemas que violan reglas ya establecidas en esta sesión. Corregirlos antes de que se autorice el deploy final.

Al terminar, reporta: archivos modificados (ruta relativa), y resultado de `npx tsc --noEmit` + `npm run build`.

---

## 1. Bug de clics rotos en `app/(alumno)/alumno/materia/[id]/page.tsx`

Este archivo (tocado en la tarea anterior para agregar `<AnnouncementComments />`) todavía usa el patrón `use(resource)` + `<Suspense>` (líneas 3, 15, 144 en la última versión revisada). Es EXACTAMENTE el mismo bug sistémico que se corrigió esta sesión en 18 archivos del lado docente: con `use()` así, los `onClick` de toda la pantalla dejan de responder — incluido, ahora, el botón de enviar comentario que se acaba de agregar dentro de `<AnnouncementComments />` en esta misma pantalla.

**Archivo de referencia con el patrón correcto ya aplicado** (mismo proyecto, mismo bug, ya resuelto): [`app/(docente)/panel/materias/[id]/actividades/[assignmentId]/page.tsx`](../app/(docente)/panel/materias/[id]/actividades/[assignmentId]/page.tsx) — usar como plantilla exacta.

**Fix:**
1. Renombrar/adaptar el componente `TablonContent({ resource, courseId, onRetry })` para que reciba `courseId` y `reloadKey` (no `resource`), y dentro de él:
   ```ts
   const [loading, setLoading] = useState(true);
   const [result, setResult] = useState<FetchResult>(/* estado inicial adecuado, revisar qué usa hoy useMateriaAlumno como default */);

   useEffect(() => {
     let isMounted = true;
     setLoading(true);
     fetchMateriaAlumno(courseId, reloadKey).then((r) => { // usar el nombre real de la función fetch de useMateriaAlumno.ts
       if (!isMounted) return;
       setResult(r);
       setLoading(false);
     });
     return () => { isMounted = false; };
   }, [courseId, reloadKey]);
   ```
   Agregar `if (loading) return <Loader.../>` (copiar el mismo spinner que hoy usa el fallback de `<Suspense>`) antes del `if (result.kind === "redirect")`/`if (result.kind === "error")` ya existentes.
2. En `app/(alumno)/alumno/materia/[id]/_hooks/useMateriaAlumno.ts`: revisar cómo expone hoy `resource`/`retry` y adaptarlo al mismo patrón `reloadKey`/`onReload` que ya usan los hooks del lado docente ya corregidos esta sesión (ver `app/(docente)/panel/materias/[id]/_hooks/useTablon.ts` como ejemplo de hook ya migrado a este patrón).
3. En el `export default function TablonAlumno()`: quitar el `<Suspense>` y pasar `courseId`/`reloadKey` directo al componente de contenido, sin crear ningún `resource`.
4. Quitar el import de `use` y `Suspense` de `'react'` si ya no se usan en el archivo.
5. **Importante:** revisar si el bug de `use()`/Suspense está presente en OTROS archivos del lado alumno (`app/(alumno)/**`) más allá de este — no se auditó esa carpeta esta sesión (la auditoría de los 18 archivos fue solo `app/(docente)`). Si encuentras otros casos similares al hacer este fix, NO los corrijas en esta tarea (mantener el cambio acotado), pero repórtalos explícitamente en la respuesta final con su ruta, para auditarlos después.

## 2. `alert()` nativos en `components/tablon/AnnouncementComments.tsx`

Líneas ~117 y ~132 (al ocultar/mostrar un comentario) usan `alert(...)` — viola la regla de esta sesión de no usar `alert()`/`confirm()` nativos.

**Fix:** reemplazar por el mismo patrón `feedback: { type: 'success' | 'error', message: string } | null` con auto-dismiss a 4 segundos, renderizado como toast fijo en la esquina superior derecha, que ya se usó en `useTablon.ts` (ver ese archivo, función `handlePublish`, como referencia exacta del patrón). Como `AnnouncementComments.tsx` es un componente compartido (usado tanto en la vista docente como alumno), el estado de `feedback` puede vivir dentro del propio componente (con su propio `useState` local) en vez de depender del hook padre — no hace falta subirlo a `useTablon.ts`/`useMateriaAlumno.ts`, basta con que el toast se renderice dentro de `AnnouncementComments.tsx` mismo.

## 3. Limpieza menor (opcional, solo si no cuesta tiempo extra)

En `app/(alumno)/alumno/materia/[id]/_hooks/useMateriaAlumno.ts` línea ~19, el campo `allowStudentComments?: boolean` en el tipo de resultado quedó sin usar en ningún lado (vestigio del switch global retirado). Si al tocar este archivo para el punto 1 es trivial quitarlo, hazlo; si no, déjalo y repórtalo como pendiente.

---

## Reglas de esta sesión (aplican igual)

- No hacer deploy ni migración — el usuario autoriza aparte, después de esta corrección.
- No expandir el alcance a otros archivos del lado alumno salvo para reportarlos (punto 1.5).
