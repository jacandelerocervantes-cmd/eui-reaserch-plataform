"use client";

// Orden aleatorio anti-copia + modo de presentación (una por una / todas
// juntas) — antes duplicado en nuevo/page.tsx y configuracion/page.tsx.
export const SecuritySettings = ({
  randomizeQuestions, setRandomizeQuestions,
  randomizeOptions, setRandomizeOptions,
  showAllQuestions, setShowAllQuestions,
}: {
  randomizeQuestions: boolean; setRandomizeQuestions: (v: boolean) => void;
  randomizeOptions: boolean; setRandomizeOptions: (v: boolean) => void;
  showAllQuestions: boolean; setShowAllQuestions: (v: boolean) => void;
}) => (
  <>
    <div>
      <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Orden Aleatorio Anti-Copia</label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 0", cursor: "pointer" }}>
        <input type="checkbox" checked={randomizeQuestions} onChange={(e) => setRandomizeQuestions(e.target.checked)} style={{ marginTop: "3px" }} />
        <span>
          <span style={{ display: "block", fontSize: "0.9rem", color: "#334155", fontWeight: "600" }}>Mezclar el ORDEN DE LAS PREGUNTAS por alumno</span>
          <span style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8" }}>Ej: a un alumno le toca la pregunta 5 primero; a otro, la pregunta 1.</span>
        </span>
      </label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 0", cursor: "pointer" }}>
        <input type="checkbox" checked={randomizeOptions} onChange={(e) => setRandomizeOptions(e.target.checked)} style={{ marginTop: "3px" }} />
        <span>
          <span style={{ display: "block", fontSize: "0.9rem", color: "#334155", fontWeight: "600" }}>Mezclar el ORDEN DE LAS OPCIONES dentro de cada pregunta</span>
          <span style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8" }}>Ej: en opción múltiple, la respuesta correcta no siempre aparece como la &quot;A&quot;.</span>
        </span>
      </label>
    </div>

    <div>
      <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Presentación de Reactivos</label>
      <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "5px", borderRadius: "14px" }}>
        <button
          onClick={() => setShowAllQuestions(false)}
          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", fontSize: "0.72rem", fontWeight: "900", cursor: "pointer", backgroundColor: !showAllQuestions ? "white" : "transparent", boxShadow: !showAllQuestions ? "0 4px 6px rgba(0,0,0,0.05)" : "none", color: !showAllQuestions ? "#1B396A" : "#64748b" }}
        >UNA POR UNA</button>
        <button
          onClick={() => setShowAllQuestions(true)}
          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", fontSize: "0.72rem", fontWeight: "900", cursor: "pointer", backgroundColor: showAllQuestions ? "white" : "transparent", boxShadow: showAllQuestions ? "0 4px 6px rgba(0,0,0,0.05)" : "none", color: showAllQuestions ? "#1B396A" : "#64748b" }}
        >TODAS JUNTAS</button>
      </div>
      {showAllQuestions && (
        <p style={{ fontSize: "0.75rem", color: "#b45309", margin: "8px 0 0", backgroundColor: "#fffbeb", padding: "8px 10px", borderRadius: "8px" }}>
          Reduce la protección anti-copia. Recomendado solo para exámenes a libro abierto o práctica de baja exigencia.
        </p>
      )}
    </div>
  </>
);
