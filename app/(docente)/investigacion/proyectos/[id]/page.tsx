'use client';

import { useParams } from 'next/navigation';
import DetalleProyectoContent from './_components/DetalleProyectoContent';
import { useProyectoDetalle } from './_hooks/useProyectoDetalle';

export default function DetalleProyecto() {
  const { id: proyectoId } = useParams<{ id: string }>();
  const { reloadKey, onReload } = useProyectoDetalle(proyectoId);

  return (
    <DetalleProyectoContent proyectoId={proyectoId} reloadKey={reloadKey} onReload={onReload} />
  );
}
