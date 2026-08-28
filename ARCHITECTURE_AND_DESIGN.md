# ARCHITECTURE_AND_DESIGN.md — EUI (TecNM Tizimín)

Manual de diseño maestro y reglas de arquitectura, extraídos del código real
(no inventados) durante la auditoría de Módulo 01_B. Ver
[docs/01_B_Refactor_y_Diseno_Base.md](docs/01_B_Refactor_y_Diseno_Base.md)
para el detalle de la auditoría, hallazgos y plan de ejecución.

---

## 1. Manual de Diseño Maestro

### 1.1 Framework

Tailwind CSS v4 (`@import "tailwindcss"` en `app/globals.css`) **combinado**
con CSS Modules por componente/página (`*.module.css`). Tailwind se usa poco
en utilidades inline; el grueso del estilo vive en los `.module.css`.

### 1.2 Paleta de colores

Definida como variables CSS en `app/globals.css`. La inconsistencia
detectada en la auditoría inicial (varios `.module.css` repetían los
hexadecimales en vez de referenciar las variables) se corrigió en los 3
archivos donde el valor coincidía exactamente con una variable existente
(`AlumnoSidebar.module.css`, `tablon.module.css`, `login.module.css`); se
agregaron variables semánticas y de superficie secundaria que faltaban
para poder hacer esa sustitución sin inventar valores nuevos.

```css
/* Identidad institucional */
--tecnm-blue: #1B396A;        /* color primario — texto de énfasis, botones principales, bordes activos */
--tecnm-blue-dark: #132a50;   /* hover de azul primario */

/* Superficie */
--bg-app: #f8fafc;            /* fondo general de la app */
--bg-surface: #ffffff;        /* tarjetas, modales, sidebar */
--bg-surface-muted: #f1f5f9;  /* headers/footers de tarjeta, hover de botón secundario */

/* Texto y bordes */
--text-main: #0f172a;
--text-muted: #64748b;
--text-subtle: #94a3b8;       /* empty states */
--border-light: #e2e8f0;
--border-muted: #cbd5e1;

/* Semántico */
--color-success: #10b981   /* verde */
--color-warning: #f59e0b   /* ámbar */
--color-danger: #ef4444    /* rojo */
--color-info: #3b82f6      /* azul foco de inputs */
--color-danger-bg: #fee2e2
--color-danger-bg-soft: #fef2f2
--color-danger-dark: #b91c1c

/* Identidad "IA" (Gemini/Copiloto) — distinta del resto de la app a propósito */
--ai-energy: #8b5cf6          /* violeta */
--gemini-gradient: linear-gradient(135deg, #4285f4, #8ab4f8, #c6dafc)
```

Nota: no se forzó la sustitución de todo hex encontrado — solo los que
coincidían exactamente con un valor de paleta ya documentado. Colores que
no calzan exactamente (ej. `#334155` en `tablon.module.css`, `#1e293b` en
`login.module.css`) se dejaron sin tocar para no introducir un cambio
visual no solicitado.

### 1.3 Tipografía

`font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;`
(sin fuente web propia — cero costo de carga, coherente con "frugal").

Escala observada (no formalizada en variables, se repite por archivo):

| Uso | Tamaño | Peso |
|---|---|---|
| Título de modal/sección | 1.25–1.5rem | 800 |
| Cuerpo | 0.9–1rem | 400–500 |
| Label / meta | 0.7–0.85rem | 600–700 |

### 1.4 Layout y navegación

- Sidebar fijo de 80px (solo íconos, label aparece en hover) —
  `components/layout/Sidebar.tsx` + `.module.css`.
- Header fijo superior — `components/layout/Header.tsx`.
- Layouts de sección con Route Groups de Next.js: `(admin)`, `(campo)`,
  `(dashboard)`, `(docente)`, `(investigacion)`, `(laboratorio)`,
  `(publico)` — cada grupo puede traer su propio `layout.tsx`.

### 1.5 Componentes base

**Botón** — ya consolidado en un único componente
(`components/ui/ExpandingButton.tsx`), con 10 variantes semánticas
(`primary/secondary/success/warning/danger/cancel/magic/ai/notify/default`).
No crear botones nuevos por archivo — usar este componente.

**Tarjeta (card)** — patrón repetido en `CourseCard.module.css` y similares:
fondo blanco, `border-radius: 16px`, borde `#e2e8f0`, barra superior de
gradiente de 6px como acento, elevación + `translateY(-4px)` al hover.

**Modal** — patrón repetido en `CourseModal.module.css`: overlay
`rgba(15,23,42,0.5)` + `backdrop-filter: blur(4px)`, tarjeta blanca
`border-radius: 16-20px`, `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)`,
footer con `cancelBtn` (outline) + `submitBtn`/`confirmButton` (relleno).

**Input** — `padding: 12px 16px`, `border: 2px solid #e2e8f0`,
`border-radius: 10px`, foco con `border-color: #3b82f6`.

---

## 2. Reglas de arquitectura (obligatorias)

- **Límite de líneas**: 400 (alta complejidad: páginas con lógica de
  negocio/integraciones) / 200 (baja complejidad: componentes UI puros,
  utilidades). Tolerancia máxima +20% → 480 / 240. Por encima de eso, el
  archivo se divide.
- **Separación UI vs. lógica**: la UI (JSX/presentación) no debe cargar
  `fetch`/`supabase.from(...)`/estado orquestador — eso vive en un hook o
  servicio que la UI consume.
- **Convención de carpetas** (ver árbol en la sección 3): para lógica
  compartida entre ≥2 rutas, va en `lib/hooks/`, `lib/services/`,
  `lib/utils/`. Para lógica exclusiva de una sola ruta, sigue el patrón que
  el propio repo ya usa (`_components/` dentro de la carpeta de la ruta,
  ignorado por el router de Next.js por el prefijo `_`) — se extiende ese
  mismo patrón con `_hooks/` y `_services/` en vez de inventar una
  convención nueva.

---

## 3. Árbol de directorios objetivo

```
eui-reaserch-plataform-main/
├── app/                                  # Rutas (Next.js App Router) — solo orquestación + JSX
│   ├── (docente)/panel/materias/[id]/calificaciones/
│   │   ├── page.tsx                      # delgado: usa el hook, renderiza la vista activa
│   │   ├── _components/                  # YA EXISTE — UnitsView, CaptureView, FinalGradesView...
│   │   └── _hooks/
│   │       └── useCalificaciones.ts      # NUEVO — todo el estado/fetchData/handlers que hoy vive en page.tsx
│   ├── alumno/materia/[id]/entregar/[assignmentId]/
│   │   ├── page.tsx                      # delgado: solo EntregarActividad + EntregarContent
│   │   ├── _components/
│   │   │   ├── AssignmentHeader.tsx      # extraído
│   │   │   ├── WorkspaceZone.tsx         # extraído
│   │   │   ├── FileZone.tsx              # extraído
│   │   │   └── ForumZone.tsx             # extraído
│   │   └── _services/
│   │       └── fetchAssignment.ts        # extraído (tipos + fetch)
│   └── alumno/materia/[id]/presentar/[examId]/
│       ├── page.tsx                      # delgado: PresentarExamen + PresentarExamenContent (JSX)
│       ├── _components/
│       │   └── ExamSplash.tsx            # extraído
│       ├── _hooks/
│       │   └── useExamSession.ts         # extraído — timer, respuestas, violaciones, autosave
│       └── _lib/
│           └── examHelpers.ts            # extraído — isAnswered/shuffle/formatTime
├── components/                            # Compartidos entre ≥2 rutas (YA correctamente separado)
│   ├── ui/            # botones, inputs genéricos — sin lógica de negocio
│   ├── layout/         # Header, Sidebar, Footer
│   ├── courses/        # CourseCard, CourseModal
│   ├── modals/          # ImportModal
│   └── ia/              # FloatingCopilot, GeminiCanvas, useMasterCopilotChat
├── lib/                                    # Lógica/servicios compartidos globalmente
│   ├── supabase.ts
│   ├── campoDb.ts
│   ├── google-services.ts
│   ├── hooks/           # (nuevo, cuando exista lógica de estado reusada entre rutas)
│   ├── services/        # (nuevo, cuando exista una llamada a API reusada entre rutas)
│   └── utils/            # (nuevo, cuando exista una función pura reusada entre rutas)
├── k6/                    # pruebas de estrés (Módulo 01)
├── docs/                   # documentación de arquitectura y auditorías
└── supabase/                # migraciones y Edge Functions (sin cambios — es infra gestionada)
```

**Nota de alcance**: `lib/hooks/`, `lib/services/`, `lib/utils/` se crean
como carpetas vacías/placeholder — hoy no hay lógica compartida entre ≥2
rutas que justifique mover algo ahí todavía (toda la lógica pesada es
local a una sola ruta). Crearlas antes de tener contenido real violaría el
principio frugal de "no diseñar para hipotéticos" — se documentan aquí como
destino acordado para la primera vez que sí aparezca ese caso.
