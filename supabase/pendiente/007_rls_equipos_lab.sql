-- 007_rls_equipos_lab.sql
--
-- Origen: qa-05a-doublecheck-02 (segunda ronda de doble check de seguridad,
-- pasada profunda sobre Módulo 02). Ver qa-05a-doublecheck-02/01-REPORTE.md
-- y 02-SOLUCION.md para el detalle completo.
--
-- Hallazgo: la ronda 1 (qa-05a-doublecheck/006_rls_hardening_kalman_version.sql)
-- cerró `using(true)` en `perfiles` y `telemetria_iot`, pero no auditó el
-- resto del árbol de políticas RLS del mismo archivo de esquema
-- (20260225000320_remote_schema.sql). Esta ronda sí lo hizo línea por línea
-- (grep exhaustivo de `using(true)`/`check(true)` sobre TODO `supabase/`) y
-- encontró una política adicional con el mismo patrón, sin cubrir por
-- ningún fix anterior:
--
--   "Lectura pública de equipos" ON public.equipos_lab
--   FOR SELECT TO public USING (true)
--
-- Cualquiera con la anon key pública (va en el bundle del navegador, no hace
-- falta sesión) podía leer el inventario completo de equipo de laboratorio
-- (nombre, modelo, estado, última calibración) vía REST directo
-- (`/rest/v1/equipos_lab?select=*`), sin pasar por la app ni por `/laboratorio`
-- (que proxy.ts sí protege exigiendo docente con access_level=1).
--
-- La tabla ya tenía una segunda política ("Gestión de equipos por staff",
-- FOR ALL a docente/investigador) que sigue intacta — esta política pública
-- adicional simplemente anulaba esa restricción para SELECT, porque las
-- políticas RLS "permissive" se combinan con OR: bastaba con que UNA fuera
-- `using(true)` para que la otra dejara de importar en la práctica.
--
-- Fix: la misma política, pero acotada a `authenticated` en vez de `public`
-- (mismo patrón que 006 usó para telemetria_iot) — cualquier usuario con
-- sesión puede seguir leyendo el inventario (ningún flujo de la app depende
-- de leerlo sin sesión: solo se usa dentro de /laboratorio, que ya exige
-- auth), pero deja de ser accesible con solo la anon key.
--
-- Idempotente: puede correrse más de una vez sin duplicar nada.

BEGIN;

DROP POLICY IF EXISTS "Lectura pública de equipos" ON public.equipos_lab;

CREATE POLICY "Lectura autenticada de equipos"
  ON public.equipos_lab
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
