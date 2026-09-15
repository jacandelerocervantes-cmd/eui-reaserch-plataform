-- Elimina las tablas exclusivas de los módulos Campo, Laboratorio e
-- Investigación, retirados de la aplicación esta sesión (código ya borrado
-- en app/(docente)/{campo,laboratorio,investigacion} y sus Edge Functions).
-- Confirmado antes de aplicar: las 8 tablas tenían 0 filas en producción.
-- (fondos_investigacion, tesistas, canvas_documentos, entradas_bitacora/
-- bitacora_eln nunca llegaron a existir como tablas reales — no aplica DROP.)

drop table if exists public.capturas_campo cascade;
drop table if exists public.misiones_campo cascade;
drop table if exists public.equipos_lab_logs cascade;
drop table if exists public.equipos_lab cascade;
drop table if exists public.telemetria_iot cascade;
drop table if exists public.proyecto_colaboradores cascade;
drop table if exists public.proyectos_investigacion cascade;
drop table if exists public.literatura_referencias cascade;
