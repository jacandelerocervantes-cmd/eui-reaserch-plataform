-- 1. Eliminar restricciones restrictivas de CHECK y FK en assignments
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_submission_type_check;
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_format_check;
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_criteria_id_fkey;

-- 2. Hacer criteria_id nullable
ALTER TABLE public.assignments ALTER COLUMN criteria_id DROP NOT NULL;

-- 3. Eliminar restricciones restrictivas en submissions si las hubiera
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
