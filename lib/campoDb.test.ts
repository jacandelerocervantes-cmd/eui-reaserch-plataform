import { describe, it, expect, beforeEach } from 'vitest'
import { campoDb, getPendingCount, getPendingCapturas, saveCaptura, markSynced } from './campoDb'

describe('campoDb — cola de sincronización offline-first (módulo Campo)', () => {
  beforeEach(async () => {
    await campoDb.capturas.clear()
  })

  it('guarda una captura como pendiente (synced=false) y la cuenta', async () => {
    await saveCaptura({
      mision_id: 'mision-1',
      tipo: 'foto',
      latitud: 21.15,
      longitud: -88.15,
      notas: 'muestra de suelo',
      campos_datos: {},
      content_url: null,
      timestamp: new Date().toISOString(),
    })

    expect(await getPendingCount()).toBe(1)
  })

  it('markSynced saca la captura de la cola de pendientes', async () => {
    const id = await saveCaptura({
      mision_id: 'mision-1',
      tipo: 'texto',
      latitud: null,
      longitud: null,
      notas: 'observación',
      campos_datos: {},
      content_url: null,
      timestamp: new Date().toISOString(),
    })

    expect(await getPendingCount()).toBe(1)

    await markSynced(id)

    expect(await getPendingCount()).toBe(0)
  })

  it('getPendingCapturas no incluye capturas ya sincronizadas', async () => {
    const idPendiente = await saveCaptura({
      mision_id: 'mision-2',
      tipo: 'audio',
      latitud: null,
      longitud: null,
      notas: '',
      campos_datos: {},
      content_url: null,
      timestamp: new Date().toISOString(),
    })
    const idSincronizada = await saveCaptura({
      mision_id: 'mision-2',
      tipo: 'audio',
      latitud: null,
      longitud: null,
      notas: '',
      campos_datos: {},
      content_url: null,
      timestamp: new Date().toISOString(),
    })
    await markSynced(idSincronizada)

    const pendientes = await getPendingCapturas()

    expect(pendientes.map((c) => c.local_id)).toEqual([idPendiente])
  })
})
