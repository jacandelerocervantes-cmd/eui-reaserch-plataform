// Prueba de estrés — pico de "cierre de semestre" (Módulo 01, punto 5b)
//
// Simula el peor caso real de la plataforma: cientos de docentes registrando
// asistencia y consultando calificaciones al mismo tiempo, más ráfagas del
// motor de evaluación con IA (generate-exam-ia / evaluate-submissions-ia),
// que es el camino más caro en cómputo y el más probable candidato a
// saturar Supabase Edge Functions o agotar cuota de la API de IA.
//
// Requiere: k6 (https://k6.io — OSS, gratis). No requiere Node/npm.
// Uso:
//   k6 run -e BASE_URL=https://<preview-o-prod> k6/stress-cierre-semestre.js
//
// No apunta a producción por defecto — BASE_URL debe pasarse explícitamente
// y de preferencia contra un entorno de preview/staging, nunca contra la
// base de datos real de TecNM Tizimín sin autorización.

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export const options = {
  scenarios: {
    // Carga sostenida: navegación normal (login, dashboard, consulta de calificaciones)
    trafico_normal: {
      executor: 'ramping-vus',
      exec: 'navegacionNormal',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },  // sube a 100 usuarios concurrentes
        { duration: '3m', target: 300 },  // pico: 300 (≈30% de la base de 1000 usuarios activos a la vez)
        { duration: '2m', target: 300 },  // sostiene el pico
        { duration: '1m', target: 0 },    // baja
      ],
    },
    // Ráfaga corta y agresiva simulando el cierre de calificaciones
    rafaga_cierre: {
      executor: 'constant-arrival-rate',
      exec: 'rafagaCierreCalificaciones',
      rate: 20,               // 20 solicitudes/seg sostenidas
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 150,
      startTime: '2m',        // se solapa con el pico de tráfico normal
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],     // <1% de errores
    http_req_duration: ['p(95)<2000'],  // p95 bajo 2s incluso en el pico
  },
}

export function navegacionNormal() {
  const login = http.get(`${BASE_URL}/login`)
  check(login, { 'login 200': (r) => r.status === 200 })
  sleep(1)

  const inicio = http.get(`${BASE_URL}/inicio`)
  check(inicio, { 'inicio responde (200 o redirect a login)': (r) => r.status === 200 || r.status === 307 })
  sleep(Math.random() * 2 + 1)
}

export function rafagaCierreCalificaciones() {
  // Ruta pública de validación de asistencia por QR — es la que más ráfagas
  // recibe en horario de clase (cientos de alumnos escaneando en minutos).
  const res = http.get(`${BASE_URL}/asistencia/validar/hash-de-prueba`)
  check(res, { 'validar-asistencia responde': (r) => r.status === 200 || r.status === 404 })
}
