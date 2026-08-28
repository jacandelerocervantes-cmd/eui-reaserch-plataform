import { use, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadValidated } from "@/lib/uploadValidated";
import type { SelectedRecord } from "../_components/types";
import type { FetchResult } from "../_services/fetchHistorial";

type UseHistorialArgs = {
  resource: Promise<FetchResult>;
  courseId: string;
  onReload: () => void;
};

export function useHistorial({ resource, courseId, onReload }: UseHistorialArgs) {
  const result = use(resource);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnitNumber, setSelectedUnitNumber] = useState<number | null>(result.ok ? result.initialUnitNumber : null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isClosingUnit, setIsClosingUnit] = useState(false);

  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  const { students, attendance, units, activeUnit } = result;

  // Asistencias filtradas solo para la unidad seleccionada
  const unitAttendance = attendance.filter(a => a.unit_number === selectedUnitNumber);

  // Columnas de fecha/sesión únicas para esa unidad
  const uniqueDates = (() => {
    const map = new Map<string, { date: string; session: number }>();
    unitAttendance.forEach(r => {
      if (!r.session_date || r.session_number == null) return;
      const key = `${r.session_date}-S${r.session_number}`;
      if (!map.has(key)) map.set(key, { date: r.session_date, session: r.session_number });
    });
    return Array.from(map.values());
  })();

  const getRecord = (sid: string, date: string, session: number) =>
    unitAttendance.find(a => a.student_id === sid && a.session_date === date && a.session_number === session);

  const selectedUnitData = units.find(u => u.unit_number === selectedUnitNumber) ?? null;
  const isSelectedUnitActive = selectedUnitData ? !selectedUnitData.is_closed : false;

  const filteredStudents = students.filter(s =>
    `${s.apellido_paterno} ${s.nombres}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.matricula.includes(searchTerm)
  );

  const handleDeleteRecord = async () => {
    if (!selectedRecord) return;
    if (!confirm("¿Eliminar este registro de asistencia? El alumno quedará sin registro en esta sesión.")) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("validated_attendances")
        .delete()
        .match({ student_id: selectedRecord.student_id, session_date: selectedRecord.session_date, session_number: selectedRecord.session_number, course_id: courseId });
      if (error) throw error;
      setShowEditModal(false);
      setFileToUpload(null);
      onReload();
    } catch (e) { alert("Error al eliminar: " + (e instanceof Error ? e.message : String(e))); } finally { setIsUpdating(false); }
  };

  const handleUpdate = async () => {
    if (!selectedRecord) return;
    setIsUpdating(true);
    try {
      let url = selectedRecord.file_url ?? null;
      if (fileToUpload) {
        const ext = fileToUpload.name.split('.').pop();
        const path = `${courseId}/${selectedRecord.student_id}_${selectedRecord.session_date}_S${selectedRecord.session_number}.${ext}`;
        const { publicUrl } = await uploadValidated({ bucket: "JUSTIFICANTES", path, file: fileToUpload, upsert: true });
        url = publicUrl;
      }

      const { error } = await supabase.from("validated_attendances").upsert({
        course_id:          courseId,
        student_id:         selectedRecord.student_id,
        session_date:       selectedRecord.session_date,
        session_number:     selectedRecord.session_number,
        unit_number:        selectedUnitNumber,
        status:             selectedRecord.new_status,
        justification_text: selectedRecord.justification || null,
        file_url:           url,
      }, { onConflict: 'course_id, student_id, session_date, session_number' });

      if (error) throw error;
      setShowEditModal(false);
      setFileToUpload(null);
      onReload();
    } catch (e) { alert("Error al guardar: " + (e instanceof Error ? e.message : String(e))); } finally { setIsUpdating(false); }
  };

  const syncWithSheets = async (unitNumber?: number, unitTitle?: string) => {
    setIsUpdating(true);
    try {
      // Usa solo los datos de la unidad que se está sellando/sincronizando
      const unitNum = unitNumber ?? selectedUnitNumber ?? undefined;
      const unitAtt = attendance.filter(a => a.unit_number === unitNum);
      const unitDates = (() => {
        const map = new Map<string, { date: string; session: number }>();
        unitAtt.forEach(r => {
          if (!r.session_date || r.session_number == null) return;
          const key = `${r.session_date}-S${r.session_number}`;
          if (!map.has(key)) map.set(key, { date: r.session_date, session: r.session_number });
        });
        return Array.from(map.values());
      })();

      const payloadAlumnos = filteredStudents.map(al => {
        let total = 0;
        const asistencias = unitDates.map(d => {
          const r = unitAtt.find(a => a.student_id === al.id && a.session_date === d.date && a.session_number === d.session);
          if (r) total += r.status;
          return { fecha: d.date, sesion: d.session, estatus: r ? r.status : 0 };
        });
        const pct = unitDates.length > 0 ? (total / unitDates.length) * 100 : 0;
        return { matricula: al.matricula, nombre_completo: `${al.apellido_paterno} ${al.nombres}`, asistencias, resumen: { porcentaje: pct, derecho_examen: pct >= 80 } };
      });

      const { data } = await supabase.functions.invoke('sync-attendance-history', {
        body: { courseId, unitNumber: unitNum, unitTitle: unitTitle ?? selectedUnitData?.title, payload: { alumnos: payloadAlumnos } }
      });
      if (data?.success && !unitNumber) alert("¡Historial sincronizado!");
    } catch { alert("Error de sincronización"); } finally { setIsUpdating(false); }
  };

  const cerrarUnidad = async () => {
    if (!activeUnit || activeUnit.unit_number !== selectedUnitNumber) return;
    if (!confirm(`¿Sellar asistencia de Unidad ${activeUnit.unit_number} — ${activeUnit.title}?\n\nSe calcularán los porcentajes finales de asistencia y se sincronizarán con el registro. Esta acción no se puede deshacer.`)) return;
    setIsClosingUnit(true);
    try {
      const { error } = await supabase.from("course_units").update({
        is_closed: true,
        closed_at: new Date().toISOString(),
      }).eq("id", activeUnit.id);
      if (error) throw error;

      await syncWithSheets(activeUnit.unit_number, activeUnit.title);
      onReload();
      alert(`Asistencia de Unidad ${activeUnit.unit_number} sellada y sincronizada.`);
    } catch (e) {
      alert("Error al cerrar unidad: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsClosingUnit(false);
    }
  };

  return {
    ok: true as const,
    units, activeUnit,
    selectedUnitNumber, setSelectedUnitNumber,
    selectedUnitData, isSelectedUnitActive,
    searchTerm, setSearchTerm,
    filteredStudents,
    uniqueDates, getRecord,
    showEditModal, setShowEditModal,
    isUpdating, isClosingUnit,
    selectedRecord, setSelectedRecord,
    fileToUpload, setFileToUpload,
    handleDeleteRecord, handleUpdate,
    syncWithSheets, cerrarUnidad,
  };
}
