import { useRef, useState } from 'react';
import { FileText, Upload, X, HardDrive, AlertCircle } from 'lucide-react';
import { validateFileContent } from '@/lib/fileValidation';

export function FileZone({
  file, onFile, required = false,
}: { file: File | null; onFile: (f: File | null) => void; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (f: File | null) => {
    setError(null);
    if (!f) { onFile(null); return; }
    const check = await validateFileContent(f);
    if (!check.ok) { setError(check.reason); if (ref.current) ref.current.value = ''; return; }
    onFile(f);
  };

  return (
    <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm space-y-4">
      <h3 className="font-black text-[#1B396A] flex items-center gap-2">
        <HardDrive size={20} />
        {required ? 'Archivo de Entrega' : 'Archivo Adicional (Opcional)'}
      </h3>

      <div
        onClick={() => !file && ref.current?.click()}
        className={`border-2 border-dashed rounded-[20px] p-8 text-center transition-all
          ${file ? 'border-blue-300 bg-blue-50/40' : 'border-slate-300 hover:border-[#1B396A] cursor-pointer hover:bg-slate-50'}`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3 bg-white rounded-[14px] p-4 border border-slate-200">
            <FileText className="text-[#1B396A]" size={22} />
            <div className="text-left">
              <div className="font-bold text-[#1B396A] text-sm">{file.name}</div>
              <div className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFile(null); }}
              className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="text-slate-400 mx-auto" size={32} />
            <p className="font-bold text-slate-600">Arrastra o haz clic para seleccionar</p>
            <p className="text-xs text-slate-400">PDF, DOCX, ZIP, XLSX — máx. 50 MB</p>
          </div>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.zip,.rar,.txt,.xlsx,.pptx,.png,.jpg,.jpeg"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!file && (
        <button
          onClick={() => ref.current?.click()}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-[14px] font-bold transition-colors"
        >
          Seleccionar archivo
        </button>
      )}
    </div>
  );
}
