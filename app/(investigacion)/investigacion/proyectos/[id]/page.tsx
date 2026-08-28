'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import DetalleProyectoContent from './_components/DetalleProyectoContent';
import { useProyectoDetalle } from './_hooks/useProyectoDetalle';

export default function DetalleProyecto() {
  const { id: proyectoId } = useParams<{ id: string }>();
  const { resource, reloadKey, onReload } = useProyectoDetalle(proyectoId);

  return (
    <Suspense fallback={
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#1B396A' }} />
      </div>
    }>
      <DetalleProyectoContent key={reloadKey} resource={resource} proyectoId={proyectoId} onReload={onReload} />
    </Suspense>
  );
}
