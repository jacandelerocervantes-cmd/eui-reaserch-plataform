# Índice — Case Study técnico (Medium / InfoQ)

**Título de trabajo**: "IA concurrente e Ingeniería Frugal en la educación superior: cómo
construimos una plataforma para más de 1000 usuarios desde Tizimín, Yucatán"

Cada subtítulo cita el documento fuente ya existente en el repositorio del cual se extraería
el contenido técnico — no hay contenido nuevo por redactar desde cero, solo traducir la
documentación de auditoría interna a formato de artículo.

## 1. El problema: escalar IA educativa sin presupuesto de hub tecnológico
Contexto de Ingeniería Frugal, arquitectura DevOps base, caché real y migración a arquitectura
Medallón (bronze/silver/gold).
- Fuente: [`01_ARQUITECTURA_DEVOPS_FRUGAL.md`](./01_ARQUITECTURA_DEVOPS_FRUGAL.md)

## 2. La matemática detrás de una calificación justa: Kalman, R²/RMSE y por qué importan
Cómo se corrige el ruido de calificación asistida por IA y cómo se valida computacionalmente
(no solo en teoría) cada ecuación usada en producción.
- Fuente: [`03_Nucleo_IA_MLOps_Matematico.md`](./03_Nucleo_IA_MLOps_Matematico.md)

## 3. De un solo modelo a un enjambre: arquitectura multi-agente y el guardrail que detiene
## prompt injection
Por qué se migró a un flujo Orquestador/Recuperador/Validador, y cómo un guardrail que corre
en 27 funciones distintas se mide con precisión/recall reales, no con intuición.
- Fuente: [`04_Multi_Agente_MCP.md`](./04_Multi_Agente_MCP.md)

## 4. GPU on-demand: OCR de alta calidad sin pagar un servidor 24/7
Cómo se integró un modelo de OCR de 30B parámetros que requiere GPU real, sin romper el
presupuesto frugal, usando Cloud Run con `min-instances=0` y un circuit breaker con fallback.
- Fuente: [`05_OCR_Unlimited_Integracion.md`](./05_OCR_Unlimited_Integracion.md)

## 5. Lo que no se puede automatizar: bloqueos reales de infraestructura y el trabajo pendiente
Los límites honestos del proyecto — qué quedó bloqueado por credenciales/cuentas de terceros
(Supabase de prueba, OAuth, Docker) y cómo se documentó en vez de simularse.
- Fuente: [`ENTORNO_DE_PRUEBAS.md`](./ENTORNO_DE_PRUEBAS.md)

## PENDIENTE (requiere acción humana)
- Redactar el artículo completo a partir de este índice (fuera del alcance de CORRE 10, que
  solo pide el índice).
- Elegir y crear cuenta/perfil en Medium o InfoQ para publicarlo.
- Aprobar qué nivel de detalle técnico/interno es aceptable hacer público (algunos documentos
  fuente mencionan decisiones internas que podrían requerir revisión antes de publicarse).
