/**
 * Auditoría estática de políticas RLS a partir del propio SQL versionado
 * (`supabase/migrations/*.sql` + `supabase/pendiente/*.sql`), sin necesitar
 * una instancia real de Postgres — cierra el gap detectado en CORRE 9
 * (DoubleCheck): "hay hardening de RLS documentado, pero cero test
 * automatizado que lo verifique en CI". No sustituye un test de integración
 * real contra RLS corriendo (eso sigue bloqueado por la falta de Docker en
 * este entorno, ver docs/ENTORNO_DE_PRUEBAS.md), pero SÍ detecta en CI la
 * regresión concreta que ya se encontró 3 veces a mano en este proyecto
 * (perfiles, telemetria_iot, equipos_lab, horarios_docente): una política
 * `TO public USING (true)` / `WITH CHECK (true)` sin restricción real.
 *
 * MÉTODO: "reproduce" el efecto acumulado de las migraciones sobre el
 * conjunto de políticas activas por tabla, procesando los archivos en orden
 * cronológico (nombre de archivo) y aplicando cada `CREATE POLICY` (agrega)
 * y `DROP POLICY` (quita) sobre un mapa `tabla::nombre -> política`. Al
 * final, el mapa refleja qué políticas quedarían activas si TODO el SQL
 * versionado (incluido `pendiente/`) se aplicara en orden — exactamente lo
 * que se audita a mano hoy.
 */

export interface ParsedPolicy {
  table: string;
  name: string;
  roles: string[];
  using: string | null;
  withCheck: string | null;
  sourceFile: string;
}

function stripOuterParens(expr: string): string {
  let e = expr.trim();
  while (e.startsWith('(') && e.endsWith(')')) {
    // Solo pelar si los paréntesis externos son realmente un par que se
    // envuelve mutuamente (evita pelar mal "(a) AND (b)").
    let depth = 0;
    let matchesAtEnd = true;
    for (let i = 0; i < e.length - 1; i++) {
      if (e[i] === '(') depth++;
      else if (e[i] === ')') depth--;
      if (depth === 0 && i < e.length - 2) { matchesAtEnd = false; break; }
    }
    if (!matchesAtEnd) break;
    e = e.slice(1, -1).trim();
  }
  return e;
}

/** true si `expr` es literalmente "true" (ignorando paréntesis/espacios envolventes). */
export function isBareTrue(expr: string | null): boolean {
  if (expr == null) return false;
  return stripOuterParens(expr).toLowerCase() === 'true';
}

function extractBalancedParen(text: string, openParenIndex: number): { body: string; endIndex: number } | null {
  if (text[openParenIndex] !== '(') return null;
  let depth = 0;
  for (let i = openParenIndex; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return { body: text.slice(openParenIndex + 1, i), endIndex: i };
    }
  }
  return null;
}

function findClauseBody(statement: string, keyword: RegExp): string | null {
  const m = keyword.exec(statement);
  if (!m) return null;
  const openIdx = statement.indexOf('(', m.index + m[0].length - 1);
  if (openIdx === -1) return null;
  const extracted = extractBalancedParen(statement, openIdx);
  return extracted ? extracted.body.trim() : null;
}

function normalizeTableName(raw: string): string {
  return raw.replace(/"/g, '').replace(/^public\./, '').trim();
}

/**
 * Quita comentarios de línea `-- ...` antes de partir en statements — los
 * comentarios de este repo son prosa larga que a veces trae paréntesis sin
 * balancear (ej. "cualquiera con la anon key)"), lo que rompía el conteo de
 * profundidad de paréntesis del splitter si no se quitaban primero.
 */
function stripLineComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

/** Divide el contenido de un archivo .sql en statements por `;` a nivel superior. */
function splitStatements(sqlRaw: string): string[] {
  const sql = stripLineComments(sqlRaw);
  const statements: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of sql) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === ';' && depth === 0) {
      statements.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) statements.push(current);
  return statements;
}

/**
 * Procesa una lista de archivos SQL (en el orden en que se deben aplicar) y
 * devuelve el conjunto de políticas activas al final, indexado por
 * `tabla::nombre`.
 */
export function replayPolicies(files: { name: string; content: string }[]): Map<string, ParsedPolicy> {
  const active = new Map<string, ParsedPolicy>();

  for (const file of files) {
    const statements = splitStatements(file.content);
    for (const raw of statements) {
      const stmt = raw.trim();
      if (!stmt) continue;

      const dropMatch = /drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+"?public"?\.?"?(\w+)"?/i.exec(stmt);
      if (dropMatch) {
        const [, name, table] = dropMatch;
        active.delete(`${normalizeTableName(table)}::${name}`);
        continue;
      }

      const createMatch = /create\s+policy\s+"([^"]+)"\s*[\r\n\s]+on\s+"?public"?\.?"?(\w+)"?/i.exec(stmt);
      if (createMatch) {
        const [, name, tableRaw] = createMatch;
        const table = normalizeTableName(tableRaw);

        const rolesMatch = /\bto\s+([a-z0-9_,\s]+?)(?:\r?\n|using|with\s+check|$)/i.exec(stmt);
        const roles = rolesMatch
          ? rolesMatch[1].split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)
          : ['public']; // Postgres: sin TO explícito, la policy aplica a PUBLIC.

        const using = findClauseBody(stmt, /\busing\s*(?=\()/i);
        const withCheck = findClauseBody(stmt, /\bwith\s+check\s*(?=\()/i);

        const key = `${table}::${name}`;
        active.set(key, { table, name, roles, using, withCheck, sourceFile: file.name });
      }
    }
  }

  return active;
}

/**
 * Filtra las políticas activas que son inseguras: alcanzan al rol `public`
 * (sin sesión — la anon key del navegador basta) y su USING o WITH CHECK es
 * literalmente `true`, es decir, sin ninguna restricción real.
 */
export function findUnsafePublicPolicies(active: Map<string, ParsedPolicy>): ParsedPolicy[] {
  return [...active.values()].filter((p) => {
    const reachesPublic = p.roles.includes('public');
    if (!reachesPublic) return false;
    return isBareTrue(p.using) || isBareTrue(p.withCheck);
  });
}
