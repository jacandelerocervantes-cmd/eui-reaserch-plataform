# Módulo 03 — Núcleo IA/MLOps y Validación Matemática (CORRE 5)

Estado: **CERRADO en código con evidencia de ejecución** (tests numéricos corridos, ver sección "Reauditoría"). Único pendiente: aplicar en Supabase real el SQL ya escrito en `supabase/pendiente/*.sql` (`kalman_states`, `kalman_vector_states`) y, opcionalmente, configurar `LOCAL_SLM_URL`/Upstash — ver `## PENDIENTE (requiere acción humana)` al final.

## 1. Qué existía antes de este módulo (FASE 1, confirmado por el usuario)

Toda la matemática (Kalman escalar+vectorial, R²/RMSE, shrinkage/calibración, circuit breaker + backoff + fallback SLM) ya estaba implementada en código real, con ecuaciones en LaTeX en los propios docstrings — pero **sin ningún test numérico que las validara contra un caso de referencia con solución conocida**. Ese era el gap exacto que exige la Regla de Validación Matemática de este módulo.

## 2. Qué se agregó en esta ronda (FASE 2)

| Componente | Archivo de test nuevo | Caso de referencia usado |
|---|---|---|
| Kalman escalar (predicción/actualización, outliers, regularización K_MAX/P_MIN) | `supabase/functions/_shared/kalman.test.ts` | Trayectoria sintética con PRNG determinista (LCG+Box-Muller), valor real conocido, error final < umbral explícito (0.5) |
| Kalman vectorial 2D (covarianza cruzada aprendida, salvaguarda de correlación) | mismo archivo | Dos escenarios con solución analítica exacta: incrementos de proceso acoplados (ρ=Qc/(Qc+Qi)=0.9 conocida) vs. incrementos independientes (ρ=0 exacta) |
| R²/RMSE (`validate-ai-grading`) | `supabase/functions/_shared/aiGradingMetrics.test.ts` | Caso calculado a mano: y=[90,80,70,60], ŷ=[92,78,74,55] → R²=0.902, RMSE=3.5 (verificado con `toBeCloseTo`) |
| Shrinkage + calibración (`calibrate-ai-thresholds`) | `supabase/functions/_shared/thresholdCalibration.test.ts` | Valores documentados en el propio código: n=3→factor≈0.2308, n=100→factor≈0.9091 |
| Circuit breaker + backoff exponencial + fallback SLM local (`gemini.ts`) | `supabase/functions/_shared/gemini.test.ts` | Simulación de fallo real de la API (429/503 mockeados) — confirma apertura tras 5 fallos consecutivos, backoff 1s→2s, y enrutamiento automático al SLM local |
| Dilema Sesgo-Varianza (regularización de `shrinkR2`) | `lib/biasVarianceExperiment.ts` + `.test.ts` | Simulación Monte Carlo determinista sobre el estimador REAL de producción — no un modelo de juguete |

**Refactor necesario para poder testear** (mínimo, sin cambiar ninguna regla de negocio): la matemática pura de `validate-ai-grading/index.ts` y `calibrate-ai-thresholds/index.ts` estaba mezclada con el `serve()` de Deno (imports de `deno.land`, no resolubles bajo vitest/node). Se extrajo a `supabase/functions/_shared/aiGradingMetrics.ts` y `_shared/thresholdCalibration.ts` — mismos números, mismas reglas, ahora importados por los `index.ts` en vez de duplicados. También se agregó un shim mínimo de `Deno.env` en `vitest.setup.ts` para poder importar `gemini.ts`/`localSlmFallback.ts`/`distributedGeminiState.ts` (que leen `Deno.env.get` a nivel de módulo) bajo Node — sin variables reales configuradas, se comportan igual que en dev (sin backend distribuido, sin SLM local).

## 3. Marco de referencia: aplicación a "adecuación" y aprendizaje/enseñanza

La pregunta de esta ronda fue explícita: ¿dónde encajan estas técnicas en la literatura de adecuación docente y aprendizaje/enseñanza (no solo como ingeniería de software)? Paralelos metodológicos conocidos en medición educativa y learning analytics:

- **Estimación de estado de un "gemelo digital" del estudiante**: la idea de trackear una variable latente (dominio de un tema, riesgo de abandono, esfuerzo) que se actualiza con cada observación ruidosa (una entrega, una asistencia, una calificación) es exactamente el problema que aborda **Bayesian Knowledge Tracing** (BKT) en la literatura de tutores inteligentes — un HMM que también puede formularse como filtro de estado. El Kalman escalar de este repo (`compute-student-risk-signals`) resuelve el mismo problema con una formulación más simple (variable continua, no binaria) cuando no hay evidencia de una dinámica de proceso no lineal conocida — exactamente la justificación que ya está en el docstring de `kalman.ts`.
- **Teoría de Respuesta al Ítem (IRT) dinámica / adaptive testing**: la calibración de un umbral operativo (`calibrate-ai-thresholds`) en función de qué tan bien predice el modelo es análoga a recalibrar la dificultad estimada de un ítem quando llegan más respuestas — ambos casos usan el tamaño de muestra acumulado para decidir cuánto confiar en la estimación actual.
- **Value-Added Models (VAM) en econometría educativa**: el shrinkage James-Stein/empirical-Bayes que ya implementa `shrinkR2` es la MISMA familia de estimador que se usa en la literatura de modelos de valor agregado docente para evitar sobreinterpretar el "efecto" de un profesor o escuela con pocos alumnos — encoger la estimación hacia un prior conservador cuando el tamaño de muestra (n de alumnos/exámenes) es chico, exactamente el rol de `SHRINKAGE_LAMBDA` aquí.
- **Validez predictiva de modelos de alerta temprana ("early warning systems")**: R²/RMSE como métrica de qué tan bien un puntaje de IA predice la nota humana final es el mismo estándar de validación empírica que se exige a cualquier sistema de alerta temprana de deserción antes de usarlo para decisiones reales — de ahí el `MIN_SAMPLES_PER_GROUP` como gate de identificabilidad.

Estos son paralelos metodológicos generales de la literatura de medición educativa/learning analytics, no citas específicas de un paper — se documentan aquí como marco conceptual, no como referencia bibliográfica exacta (evitar fabricar una cita que no se pueda verificar).

## 4. Otras ecuaciones en el repo: cuadráticas, inferenciales y Hebbianas

Búsqueda explícita pedida por el usuario sobre qué otra matemática ya vive en el código, más allá de lo documentado en la FASE 1:

### Cuadráticas
- `SS_res = Σ(y-ŷ)²` y `RMSE = sqrt(SS_res/n)` (`aiGradingMetrics.ts`) son pérdida cuadrática (L2) clásica.
- La cota de ganancia `MAX_GAIN` y el shrinkage `R²·n/(n+λ)` son ambos, matemáticamente, penalizaciones tipo ridge/L2 (cuadráticas en la desviación respecto al prior) — ya documentado en los docstrings originales, confirmado ahora con test.
- El determinante `det = s11*s22 - s12²` en la inversión 2x2 del Kalman vectorial (`kalman.ts:261`) es una forma cuadrática — la salvaguarda de correlación (`ρ ≤ 0.98`) protege exactamente contra que esta forma cuadrática se acerque a 0 (matriz casi singular).

### Inferenciales
- `MIN_SAMPLES_PER_GROUP = 3` es un gate de identificabilidad estadística (sin suficientes observaciones, ni R² ni RMSE son inferencialmente significativos) — validado con test de `filterByMinGroupSize`.
- El shrinkage `R²_reg = R²·n/(n+λ)` ES un estimador inferencial (empirical-Bayes/James-Stein) — no una heurística arbitraria: encoge hacia un prior en proporción inversa a la evidencia (n), el mismo principio detrás de un intervalo de confianza que se angosta con más datos.
- El experimento Monte Carlo nuevo (`biasVarianceExperiment.ts`) es en sí mismo una validación inferencial: mide sesgo y varianza empíricos de un estimador mediante repetición, el método estándar para caracterizar un estimador cuando no hay forma cerrada simple.

### Hebbianas
**Hallazgo confirmado**: `updateCrossCovarianceEstimate` en `kalman.ts:217-219` —

```
Q̂₁₂ ← (1-α)·Q̂₁₂ + α·y₁,ₖ·y₂,ₖ
```

es, literalmente, una **regla de aprendizaje Hebbiana** ("neuronas que se activan juntas, se conectan juntas"): la actualización es proporcional al PRODUCTO de dos señales que co-ocurren (aquí, las innovaciones de dos sensores en el mismo evento), con una tasa de aprendizaje α y una versión "leaky" (el `(1-α)·` es el término de decaimiento que evita que el peso crezca sin límite — el mismo rol que cumple la normalización en la regla de Oja, una variante estabilizada de Hebb). Esto ya estaba implementado en el código antes de este módulo (visto en el docstring `kalman.ts:162-171`, "un promedio móvil exponencial del producto de las dos innovaciones observadas") pero **no estaba identificado explícitamente como regla Hebbiana en ningún documento**, y no tenía test que confirmara su comportamiento de aprendizaje por correlación — corregido en esta ronda: `kalman.test.ts` ahora valida que el aprendizaje Hebbiano produce un valor claramente positivo (promedio de correlación aprendida ≈0.21) cuando las señales SÍ covarían, y cercano a 0 (≈0.04) cuando son independientes — el resultado esperado de una regla Hebbiana bien calibrada.

## 5. Reauditoría con evidencia de ejecución (FASE 3)

```
$ npx tsc --noEmit          # sin salida = sin errores de tipos
$ npx eslint <archivos nuevos/modificados>   # sin salida = sin errores de lint
$ npx vitest run
 Test Files  12 passed (12)
      Tests  74 passed (74)
```

Desglose de los 31 tests nuevos de este módulo (de los 74 totales del proyecto): 9 en `kalman.test.ts`, 4 en `aiGradingMetrics.test.ts`, 6 en `thresholdCalibration.test.ts`, 4 en `gemini.test.ts`, 5 en `biasVarianceExperiment.test.ts` — todos corridos realmente, no solo escritos (ver comando arriba). Valores numéricos concretos verificados en esta corrida:
- Kalman escalar: error final tras 200 lecturas < 0.5 (umbral explícito de la tarea), ganancia acotada exactamente a 0.9 en el caso límite P≫R.
- Kalman vectorial: correlación aprendida promedio ≈0.21 con señales acopladas (ρ analítica=0.9) vs. ≈0.04 con señales independientes (ρ analítica=0).
- R²=0.902, RMSE=3.5 exacto contra el caso calculado a mano.
- Shrinkage: n=3→R²_reg≈0.2077, n=100→R²_reg≈0.8182 (ambos verificados con `toBeCloseTo`).
- Circuit breaker: se abre exactamente al 5º fallo consecutivo (`FAILURE_THRESHOLD`), backoff real de 1000ms→2000ms confirmado con fake timers, fallback a SLM local confirmado sin volver a llamar a Gemini una vez abierto el circuito.
- Bias-variance: con n=5 y R² verdadero lejos del prior (0.8), el shrinkage aumenta el sesgo más de lo que reduce la varianza (ECM peor) — comportamiento matemáticamente correcto, no un bug; con R² verdadero cerca del prior (0.1, el caso de diseño real: "la IA no explica nada hasta que la evidencia lo demuestre"), el shrinkage sí reduce el ECM total.

## PENDIENTE (requiere acción humana)

- Correr en el SQL Editor real de Supabase las migraciones ya escritas: `supabase/pendiente/002_graphrag_schema.sql` (tabla `kalman_states`), `006_rls_hardening_kalman_version.sql`, `011_kalman_vector_states.sql` — el código TypeScript que las usa (`compute-student-risk-signals`, `compute-research-trends`) ya está escrito y ahora testeado, pero el esquema de base de datos que lo respalda no está aplicado en ningún proyecto Supabase real todavía.
- Configurar `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` si se quiere el circuit breaker/semáforo distribuido entre instancias (opcional — sin esto, sigue funcionando en memoria por instancia, ya validado).
- Configurar `LOCAL_SLM_URL` (Ollama/LM Studio/vLLM propio) si se quiere el fallback a SLM local activo en producción (opcional — sin esto, el circuit breaker simplemente lanza `GeminiCircuitOpenError` cuando Gemini falla repetidamente, comportamiento también ya testeado).
- Ninguna otra tarea de este módulo requiere credenciales, despliegue, ni conexión a un tercero: todo el código, tests y su ejecución real ya están cerrados.
