import { useEffect, useState } from "react";
import { fetchRiesgo, type FetchResult } from "../_services/fetchRiesgo";

export function useRiesgoAcademico(courseId: string, reloadKey: number) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>({ ok: false, error: "" });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchRiesgo(courseId, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, reloadKey]);

  if (loading) return { loading: true as const };
  if (!result.ok) return { loading: false as const, ok: false as const, error: result.error };

  // Agrupa las filas por número de clúster (los excluidos por falta de
  // señales quedan aparte, en su propia sección — nunca mezclados con un
  // clúster real como si tuvieran un perfil confiable).
  const clusters = new Map<number, typeof result.rows>();
  const excluidos: typeof result.rows = [];
  for (const row of result.rows) {
    if (row.cluster === null) { excluidos.push(row); continue; }
    if (!clusters.has(row.cluster)) clusters.set(row.cluster, []);
    clusters.get(row.cluster)!.push(row);
  }

  const clusterGroups = Array.from(clusters.entries())
    .map(([cluster, rows]) => ({ cluster, label: rows[0].cluster_label ?? "—", rows }))
    // Prioritario primero, "sin riesgo" al final — orden de atención para el docente.
    .sort((a, b) => {
      if (a.label === "Sin riesgo aparente") return 1;
      if (b.label === "Sin riesgo aparente") return -1;
      return b.rows.length - a.rows.length;
    });

  return { loading: false as const, ok: true as const, clusterGroups, excluidos, kUsado: result.kUsado, totalAlumnos: result.rows.length };
}
