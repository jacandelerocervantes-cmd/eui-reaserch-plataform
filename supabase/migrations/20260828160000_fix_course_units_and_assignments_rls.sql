-- 1. Políticas RLS para course_units
ALTER TABLE public.course_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_units_select_all" ON public.course_units;
DROP POLICY IF EXISTS "course_units_insert_docente" ON public.course_units;
DROP POLICY IF EXISTS "course_units_update_docente" ON public.course_units;
DROP POLICY IF EXISTS "course_units_delete_docente" ON public.course_units;

CREATE POLICY "course_units_select_all"
  ON public.course_units
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "course_units_insert_docente"
  ON public.course_units
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_units.course_id
      AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'docente')
    )
  );

CREATE POLICY "course_units_update_docente"
  ON public.course_units
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_units.course_id
      AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'docente')
    )
  );

CREATE POLICY "course_units_delete_docente"
  ON public.course_units
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_units.course_id
      AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'docente')
    )
  );

-- 2. Políticas RLS para assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_select_all" ON public.assignments;
DROP POLICY IF EXISTS "assignments_docente_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_docente_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_docente_delete" ON public.assignments;

CREATE POLICY "assignments_select_all"
  ON public.assignments
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "assignments_docente_insert"
  ON public.assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id
      AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'docente')
    )
  );

CREATE POLICY "assignments_docente_update"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id
      AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'docente')
    )
  );

CREATE POLICY "assignments_docente_delete"
  ON public.assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = assignments.course_id
      AND c.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'docente')
    )
  );

-- 3. Políticas RLS para activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_select_all" ON public.activities;
CREATE POLICY "activities_select_all"
  ON public.activities
  FOR SELECT
  TO authenticated, anon
  USING (true);
