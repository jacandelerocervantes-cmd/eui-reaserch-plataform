import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { replayPolicies, findUnsafePublicPolicies, isBareTrue } from './rlsPolicyAudit';

// ── 1. Prueba del propio parser contra SQL sintético — independiente del
// estado actual del repo, para que el test siga siendo válido aunque algún
// día ya no queden políticas using(true) reales que auditar. ──────────────
describe('rlsPolicyAudit — parser (SQL sintético)', () => {
  it('detecta una política pública con USING (true) sin restricción', () => {
    const files = [{
      name: '001_bad.sql',
      content: `
        create policy "Lectura pública de X"
          on "public"."x"
          as permissive
          for select
          to public
        using (true);
      `,
    }];
    const active = replayPolicies(files);
    const unsafe = findUnsafePublicPolicies(active);
    expect(unsafe).toHaveLength(1);
    expect(unsafe[0].table).toBe('x');
    expect(unsafe[0].name).toBe('Lectura pública de X');
  });

  it('detecta WITH CHECK (true) público en INSERT', () => {
    const files = [{
      name: '001_bad_insert.sql',
      content: `
        create policy "Insert abierto"
          on "public"."y"
          as permissive
          for insert
          to public
        with check (true);
      `,
    }];
    const unsafe = findUnsafePublicPolicies(replayPolicies(files));
    expect(unsafe).toHaveLength(1);
  });

  it('un DROP POLICY posterior limpia la política insegura (patrón real de 006/007)', () => {
    const files = [
      {
        name: '001_base.sql',
        content: `
          create policy "Lectura pública de perfiles"
            on "public"."perfiles"
            as permissive
            for select
            to public
          using (true);
        `,
      },
      {
        name: '006_fix.sql',
        content: `
          drop policy if exists "Lectura pública de perfiles" on "public"."perfiles";

          create policy "Lectura autenticada de perfiles"
            on "public"."perfiles"
            as permissive
            for select
            to authenticated
          using (auth.uid() = id);
        `,
      },
    ];
    const active = replayPolicies(files);
    const unsafe = findUnsafePublicPolicies(active);
    expect(unsafe).toHaveLength(0);
    expect(active.get('perfiles::Lectura autenticada de perfiles')?.roles).toEqual(['authenticated']);
  });

  it('NO marca como insegura una política authenticated con USING (true) (patrón real de telemetria_iot/equipos_lab tras el fix: el rol ya no es public)', () => {
    const files = [{
      name: '007.sql',
      content: `
        create policy "Lectura autenticada de equipos"
          on "public"."equipos_lab"
          as permissive
          for select
          to authenticated
        using (true);
      `,
    }];
    expect(findUnsafePublicPolicies(replayPolicies(files))).toHaveLength(0);
  });

  it('NO marca como insegura una condición compuesta que solo CONTIENE "true" como parte de una expresión mayor', () => {
    const files = [{
      name: '001.sql',
      content: `
        create policy "Materiales visibles con inscripcion"
          on "public"."materiales_boveda"
          as permissive
          for select
          to public
        using (((es_visible = true) AND (EXISTS ( SELECT 1 FROM public.inscripciones WHERE inscripciones.materia_id = materiales_boveda.materia_id AND inscripciones.alumno_id = auth.uid()))));
      `,
    }];
    expect(findUnsafePublicPolicies(replayPolicies(files))).toHaveLength(0);
  });

  it('isBareTrue pela paréntesis envolventes pero no confunde expresiones compuestas', () => {
    expect(isBareTrue('true')).toBe(true);
    expect(isBareTrue('(true)')).toBe(true);
    expect(isBareTrue('((true))')).toBe(true);
    expect(isBareTrue('es_visible = true')).toBe(false);
    expect(isBareTrue('(a) AND (b)')).toBe(false);
    expect(isBareTrue(null)).toBe(false);
  });
});

// ── 2. Prueba real contra el SQL versionado del repo — esta es la que
// cierra el gap de CORRE 9: si algún PR futuro reintroduce una política
// `TO public USING (true)`/`WITH CHECK (true)` en migrations/ o pendiente/,
// esta prueba falla en CI sin necesitar una base de datos real. ───────────
describe('rlsPolicyAudit — SQL real del repo (migrations/ + pendiente/, en orden cronológico)', () => {
  function readSqlDir(dir: string): { name: string; content: string }[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => ({ name: f, content: fs.readFileSync(path.join(dir, f), 'utf-8') }));
  }

  const migrationsDir = path.join(__dirname, '..', '..', 'supabase', 'migrations');
  const pendienteDir = path.join(__dirname, '..', '..', 'supabase', 'pendiente');
  const files = [...readSqlDir(migrationsDir), ...readSqlDir(pendienteDir)];

  it('encuentra y parsea SQL real (guarda contra un parser roto que "pasa" por no encontrar nada)', () => {
    expect(files.length).toBeGreaterThan(0);
    const active = replayPolicies(files);
    // El esquema base define decenas de políticas — un número bajo aquí
    // significaría que el parser dejó de reconocer el formato real.
    expect(active.size).toBeGreaterThan(20);
  });

  it('ninguna política activa (tras aplicar migrations/ + pendiente/ en orden) es pública sin restricción real', () => {
    const active = replayPolicies(files);
    const unsafe = findUnsafePublicPolicies(active);
    if (unsafe.length > 0) {
      const detail = unsafe.map((p) => `  - ${p.table}::"${p.name}" (definida en ${p.sourceFile}, roles=[${p.roles.join(',')}])`).join('\n');
      throw new Error(`Se encontraron ${unsafe.length} política(s) RLS públicas sin restricción real:\n${detail}`);
    }
    expect(unsafe).toHaveLength(0);
  });
});
