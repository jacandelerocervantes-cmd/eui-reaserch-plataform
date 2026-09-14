import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  citations: number;
  venue: string | null;
  doi: string | null;
  url: string | null;
  is_oa: boolean;
  abstract: string | null;
};

export function useRadarAcademico() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ years: 0, open_access: false });
  const [results, setResults] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchDone(false);
    setSearchError(null);
    try {
      const { data, error } = await supabase.functions.invoke('search-literature', {
        body: { query: query.trim(), filters: { years: filters.years || undefined, open_access: filters.open_access || undefined } },
      });
      if (error) throw error;
      setResults(data.data.papers ?? []);
      setTotal(data.data.total ?? 0);
      setTookMs(data.data.took_ms ?? 0);
      setSearchDone(true);
    } catch (e) {
      console.error(e);
      setSearchError(e instanceof Error ? e.message : "No se pudo completar la búsqueda. Intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async (paper: Paper) => {
    setSavingId(paper.id);
    setSaveError(null);
    try {
      if (paper.doi) {
        const { error } = await supabase.functions.invoke('import-doi-metadata', { body: { doi: paper.doi } });
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('literatura_referencias').insert({
          titulo: paper.title,
          autores: paper.authors,
          año: paper.year,
          url: paper.url,
          resumen: paper.abstract,
          docente_id: user?.id,
        });
        if (error) throw error;
      }
      setSavedIds(s => new Set([...s, paper.id]));
    } catch (e) {
      console.error("Error guardando referencia desde el radar:", e);
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar este paper en tu biblioteca.");
    } finally {
      setSavingId(null);
    }
  };

  const copyBibtex = (paper: Paper) => {
    const key = `${(paper.authors[0] ?? 'Unknown').split(' ').pop()}${paper.year ?? ''}`;
    const bibtex = `@article{${key},\n  title={${paper.title}},\n  author={${paper.authors.join(' and ')}},\n  year={${paper.year ?? 'n.d.'}},\n  journal={${paper.venue ?? 'Unknown'}},\n  doi={${paper.doi ?? ''}}\n}`;
    navigator.clipboard.writeText(bibtex).catch(() => {});
  };

  return {
    query, setQuery,
    filters, setFilters,
    results,
    total,
    tookMs,
    isSearching,
    searchError,
    savedIds,
    savingId,
    saveError,
    searchDone,
    handleSearch,
    handleSave,
    copyBibtex,
  };
}
