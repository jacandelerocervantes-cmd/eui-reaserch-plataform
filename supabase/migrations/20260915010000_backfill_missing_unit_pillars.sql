-- Migración: Backfill de los 3 pilares estándar de evaluación en course_units
-- Creado: 2026-09-15
-- Contexto: Garantiza que todas las unidades existentes cuenten con los 3 pilares
-- estándar (Asistencia 10%, Actividades 40%, Evaluaciones 50%) para evitar errores
-- de inserción/upsert 23502 al configurar o calificar unidades antiguas.

-- 1. Asegurar id DEFAULT gen_random_uuid() en activities
ALTER TABLE public.activities ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Backfill de Asistencia (10%) para unidades sin criterio de asistencia
INSERT INTO public.activities (unit_id, name, weight_percentage)
SELECT cu.id, 'Asistencia', 10
FROM public.course_units cu
WHERE NOT EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.unit_id = cu.id 
      AND lower(a.name) LIKE '%asist%'
);

-- 3. Backfill de Actividades (40%) para unidades sin criterio de actividades/tareas
INSERT INTO public.activities (unit_id, name, weight_percentage)
SELECT cu.id, 'Actividades', 40
FROM public.course_units cu
WHERE NOT EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.unit_id = cu.id 
      AND (lower(a.name) LIKE '%activ%' OR lower(a.name) LIKE '%tarea%')
);

-- 4. Backfill de Evaluaciones (50%) para unidades sin criterio de evaluaciones/exámenes
INSERT INTO public.activities (unit_id, name, weight_percentage)
SELECT cu.id, 'Evaluaciones', 50
FROM public.course_units cu
WHERE NOT EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.unit_id = cu.id 
      AND (lower(a.name) LIKE '%eval%' OR lower(a.name) LIKE '%examen%')
);

