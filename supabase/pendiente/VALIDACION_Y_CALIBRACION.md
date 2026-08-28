# Validación empírica y calibración de umbrales — cómo funciona el loop completo

Cierra las tareas 2, 3 y 4 de `mds/03_Nucleo_IA_MLOps.md`. Esto NO es teoría aparte — describe exactamente lo que hacen `validate-ai-grading` y `calibrate-ai-thresholds`, ya construidas.

## El loop, en 4 pasos

```
1. INGESTA (ya sucede sola, no hay que construir nada)
   Docente revisa una nota de IA en la UI existente
   → escribe evaluation_responses.final_score / evaluations.final_score
   → ESE es el dato de validación. No hay pipeline nuevo que alimentar.

2. VALIDACIÓN — validate-ai-grading (bajo demanda o programable)
   Compara score_ia/suggested_score (predicción) vs. final_score (verdad humana)
   → calcula R² y RMSE reales
   → filtra: solo exámenes/actividades con ≥3 notas ya corregidas por un
     humano (si un examen tiene 1-2 correcciones, no hay suficiente señal)
   → guarda el resultado en ai_calibration_state

3. AJUSTE — calibrate-ai-thresholds (se corre después de cada validación)
   Lee el R²/RMSE más reciente
   → aplica una regla fija (no una "IA" decidiendo en secreto, ver código)
   → escribe confidence_threshold: qué % de calificaciones de IA se deben
     mandar a revisión humana obligatoria antes de publicarse

4. CONSUMO — pendiente de conectar (no es "falta de datos", es un cable que
   falta tender)
   bulk-evaluate-exams / evaluate-submissions-ia deberían LEER ese
   confidence_threshold antes de auto-publicar una nota de IA. Hoy no lo
   hacen — calibrate-ai-thresholds calcula y guarda el número correcto,
   pero nada lo está leyendo todavía.
```

**¿Cómo se va validando?** Automáticamente, con datos reales que ya se generan solos cada vez que un docente corrige una nota de IA — no hay "subida de datos" que hacer para esto específicamente, a diferencia de Campo/Laboratorio (que sí necesitaban un pipeline de ingesta nuevo, porque ahí no existía ningún dato previo).

**¿Cómo se va ajustando?** Con la tabla de reglas fija que está en el código de `calibrate-ai-thresholds` (R²≥0.85 y RMSE≤5 → 10% revisión; R²≥0.70 → 25%; R²≥0.50 → 50%; menos que eso → 100%). No es una caja negra: cada vez que se recalibra, el `regla_aplicada` que se guarda dice en texto exactamente por qué se llegó a ese número.

## Sesgo-Varianza en este sistema (tarea 4 del md)

En un modelo de ML clásico, sesgo-varianza es sobre los *parámetros del modelo*. Aquí no hay un modelo entrenado con pesos propios — es LLM-as-judge (Gemini evaluando con un prompt). El balance sesgo-varianza real de este sistema no está en pesos que ajustar, está en **cuánto confiar en el juicio de la IA vs. exigir revisión humana**:

- **Alto sesgo** = confiar ciegamente en `score_ia` siempre (`confidence_threshold` bajo cuando no está justificado): el sistema es consistente pero sistemáticamente equivocado si el LLM tiene un patrón de error (ej. siempre generoso con respuestas largas, sin importar el contenido).
- **Alta varianza** = desconfiar de todo y mandar el 100% a revisión humana siempre, sin importar qué tan bien le esté yendo a la IA: pierdes toda la ganancia de eficiencia de tener IA, y metes la inconsistencia de revisión humana caso por caso.
- El `confidence_threshold` calibrado empíricamente **es** el punto de balance: sube automáticamente (más revisión = más "varianza" controlada por humanos) cuando R²/RMSE muestran que la IA se está equivocando más, y baja (más autonomía a la IA = menos costo operativo) cuando la evidencia real muestra que es confiable.

## Regularización — por qué L1/L2 no aplica literalmente aquí

El md pedía "Regularización (L1/L2, Dropout)" asumiendo un modelo entrenado con pesos. Aquí no hay pesos que penalizar — sería inventar regularización donde no hay nada que regularizar. El **equivalente real** en este sistema es el propio `confidence_threshold`: actúa como un regularizador del *proceso completo* (IA + humano), no de un vector de parámetros — limita cuánto puede "sobreajustarse" el sistema a la conveniencia de auto-publicar todo, forzando una fracción de contraste humano proporcional a la evidencia de error real. Si en el futuro se entrena un modelo propio (no LLM-as-judge, sino un clasificador/regresor entrenado con las correcciones humanas acumuladas), ahí sí aplicaría L1/L2 clásico sobre sus pesos — hoy no hay ese modelo, así que documentar una fórmula de regularización de pesos sería ficción.
