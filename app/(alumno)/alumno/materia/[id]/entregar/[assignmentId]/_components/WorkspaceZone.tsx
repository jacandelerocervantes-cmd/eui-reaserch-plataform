import { CheckCircle2, AlertCircle, Cloud, ExternalLink } from 'lucide-react';
import { typeMeta, type Assignment, type Submission } from '../_services/fetchAssignment';

export function WorkspaceZone({
  assignment, submission, confirmed, onConfirm,
}: { assignment: Assignment; submission?: Submission | null; confirmed: boolean; onConfirm: (v: boolean) => void }) {
  const meta = typeMeta(assignment.submission_type);
  const url = submission?.content_url || assignment.workspace_url;

  return (
    <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm space-y-4">
      <h3 className="font-black text-[#1B396A] flex items-center gap-2">
        <Cloud size={20} /> Entorno de Trabajo Colaborativo
      </h3>

      {url ? (
        <>
          <div style={{ backgroundColor: meta.bg }} className="rounded-[16px] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ color: meta.color }}>{meta.icon}</div>
              <div>
                <div className="font-black text-slate-800">{meta.label} de la Actividad</div>
                <div className="text-xs text-slate-500 font-medium">Puedes editar y colaborar en este documento directamente</div>
              </div>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: meta.color }}
              className="flex items-center gap-2 text-white px-5 py-2.5 rounded-[12px] font-bold text-sm hover:opacity-90 transition-opacity no-underline"
            >
              Abrir <ExternalLink size={15} />
            </a>
          </div>

          <label className={`flex items-center gap-3 p-4 rounded-[16px] border-2 cursor-pointer transition-all
            ${confirmed ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => onConfirm(e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <div>
              <div className="font-bold text-slate-800">He completado mi trabajo en el documento</div>
              <div className="text-xs text-slate-500 font-medium">El docente podrá ver el historial de ediciones del documento en Google Drive.</div>
            </div>
            {confirmed && <CheckCircle2 className="text-emerald-500 ml-auto flex-shrink-0" size={22} />}
          </label>
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 text-amber-700 font-medium text-sm flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          El entorno de trabajo colaborativo se está generando en Google Drive. Consulta con tu profesor o intenta en unos momentos.
        </div>
      )}
    </div>
  );
}

