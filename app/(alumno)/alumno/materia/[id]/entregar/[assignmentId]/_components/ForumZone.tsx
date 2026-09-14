import { MessageSquare } from 'lucide-react';

export function ForumZone({ text, onText }: { text: string; onText: (v: string) => void }) {
  return (
    <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm space-y-4">
      <h3 className="font-black text-[#1B396A] flex items-center gap-2">
        <MessageSquare size={20} /> Tu Participación
      </h3>
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Escribe tu respuesta o aportación aquí..."
        rows={8}
        className="w-full p-4 border-2 border-slate-200 rounded-[16px] font-medium text-slate-700 resize-none focus:outline-none focus:border-[#1B396A] transition-colors"
      />
      <div className="text-right text-xs text-slate-400 font-medium">{text.length} caracteres</div>
    </div>
  );
}
