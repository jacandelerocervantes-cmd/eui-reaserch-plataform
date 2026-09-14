import { Clock, AlertCircle } from 'lucide-react';
import { typeMeta, type Assignment } from '../_services/fetchAssignment';

export function AssignmentHeader({ assignment, isOverdue }: { assignment: Assignment; isOverdue: boolean }) {
  const meta = typeMeta(assignment.submission_type);
  const deadline = assignment.soft_deadline ? new Date(assignment.soft_deadline) : null;

  return (
    <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <div style={{ backgroundColor: meta.bg, color: meta.color }} className="p-3 rounded-[16px]">
          {meta.icon}
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{meta.label}</div>
          <h1 className="text-2xl font-black text-[#1B396A]">{assignment.title}</h1>
        </div>
      </div>

      {assignment.description && (
        <p className="text-slate-600 leading-relaxed">{assignment.description}</p>
      )}

      {deadline && (
        <div className={`flex items-center gap-2 text-sm font-bold ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
          <Clock size={15} />
          {isOverdue
            ? `Plazo vencido — ${deadline.toLocaleDateString('es-MX', { dateStyle: 'long' })}`
            : `Cierra: ${deadline.toLocaleDateString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}`}
        </div>
      )}

      {isOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-[12px] p-3 flex items-start gap-2 text-red-700 text-sm font-medium">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
          Esta entrega se marcará como <strong>tardía</strong>
          {assignment.late_penalty_percent > 0 && ` con penalización del ${assignment.late_penalty_percent}%`}.
        </div>
      )}
    </div>
  );
}
