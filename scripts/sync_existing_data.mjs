const SUPABASE_URL = "https://inhauwsdbgtiofxxpggp.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluaGF1d3NkYmd0aW9meHhwZ2dwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ1MDYxOSwiZXhwIjoyMDg3MDI2NjE5fQ.Ryt6sYKR-3rlsAEV9Enrm4sXpP8Zz5YnUTcgXFMhGBA";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzG30Cqgh8W4YdFrB92zPwWSDeJCrhPzrQ-zRz3NFC0UodZOygpikpnUhAlQ-H66gaMTw/exec";
const APPS_SCRIPT_SECRET = "101e018b8f8a0da7375d4975e46c8bfce605fbbaf3f7ede456bc6466d5836595";

async function supabaseGet(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json"
    }
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Supabase Error:", data);
    throw new Error(JSON.stringify(data));
  }
  return data;
}

async function callAppsScript(action, payload) {
  console.log(`  -> Enviando a Google Apps Script [${action}]...`);
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: APPS_SCRIPT_SECRET,
      action,
      payload
    })
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function run() {
  console.log("=== SINCRONIZACIÓN COMPLETA SUPABASE -> GOOGLE SHEETS ===");
  
  const courses = await supabaseGet("courses?select=id,title,google_sheet_id");
  console.log(`Materias encontradas: ${courses.length}`);

  for (const course of courses) {
    if (!course.google_sheet_id) {
      console.log(`Materia "${course.title}" (${course.id}) no tiene google_sheet_id. Saltando...`);
      continue;
    }
    console.log(`\n======================================================`);
    console.log(`Sincronizando materia: ${course.title}`);
    console.log(`Google Sheet ID: ${course.google_sheet_id}`);
    console.log(`======================================================`);

    // 1. Obtener alumnos
    const students = await supabaseGet(`students?course_id=eq.${course.id}&select=id,matricula,apellido_paterno,apellido_materno,nombres,correo&order=apellido_paterno`);
    console.log(`1. Alumnos encontrados: ${students.length}`);

    // 2. Obtener equipos
    const teams = await supabaseGet(`teams?course_id=eq.${course.id}&select=id,name`);
    const teamMembers = await supabaseGet(`team_members?select=team_id,student_id`);
    console.log(`2. Equipos encontrados: ${teams.length}`);

    // Mapear equipos por alumno
    const studentTeamsMap = {};
    for (const tm of teamMembers) {
      const team = teams.find(t => t.id === tm.team_id);
      if (team) {
        if (!studentTeamsMap[tm.student_id]) studentTeamsMap[tm.student_id] = [];
        studentTeamsMap[tm.student_id].push(team.name);
      }
    }

    const alumnosPayload = students.map(s => {
      const tNames = studentTeamsMap[s.id];
      return {
        matricula: s.matricula,
        apellido_paterno: s.apellido_paterno,
        apellido_materno: s.apellido_materno || "",
        nombres: s.nombres,
        correo: s.correo || "",
        equipos: tNames && tNames.length > 0 ? tNames.join(", ") : "Sin equipo"
      };
    });

    // Sincronizar Pestaña LISTA_ALUMNOS con Equipos
    const syncEquiposRes = await callAppsScript("sincronizarEquipos", {
      googleSheetId: course.google_sheet_id,
      alumnos: alumnosPayload
    });
    console.log(`  ? LISTA_ALUMNOS sincronizada:`, JSON.stringify(syncEquiposRes.data || syncEquiposRes));

    // 3. Obtener todas las asistencias validadas
    const attendances = await supabaseGet(`validated_attendances?course_id=eq.${course.id}&select=student_id,session_date,session_number,status&order=session_date,session_number`);
    console.log(`3. Registros de asistencia encontrados: ${attendances.length}`);

    // Agrupar asistencias por [session_date + "_" + session_number]
    const sessionsGroup = {};
    for (const att of attendances) {
      const key = `${att.session_date}__S${att.session_number}`;
      if (!sessionsGroup[key]) {
        sessionsGroup[key] = {
          date: att.session_date,
          sessionNumber: att.session_number,
          records: {}
        };
      }
      sessionsGroup[key].records[att.student_id] = att.status !== undefined ? att.status : 1;
    }

    const sessionKeys = Object.keys(sessionsGroup).sort();
    console.log(`  Sesiones únicas a sincronizar en UNIDAD 1: ${sessionKeys.length}`);

    for (const key of sessionKeys) {
      const ses = sessionsGroup[key];
      const matriculaMap = {};
      
      // Inicializar a todos en falta (0)
      for (const s of students) {
        matriculaMap[s.matricula] = 0;
      }
      // Marcar estatus real
      for (const [studentId, status] of Object.entries(ses.records)) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          matriculaMap[student.matricula] = status;
        }
      }

      console.log(`    -> Sincronizando columna: ${ses.date} (S${ses.sessionNumber})...`);
      const attRes = await callAppsScript("registrarAsistencia", {
        googleSheetId: course.google_sheet_id,
        asistenciaMap: matriculaMap,
        fecha: ses.date,
        sessionNumber: ses.sessionNumber,
        unitNumber: 1
      });
      console.log(`       Resultado:`, JSON.stringify(attRes.data || attRes));
    }
  }

  console.log("\n======================================================");
  console.log("=== SINCRONIZACIÓN COMPLETADA CON TOTAL ÉXITO ===");
  console.log("======================================================");
}

run().catch(console.error);
