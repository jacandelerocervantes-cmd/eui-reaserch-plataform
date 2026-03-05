// deno-lint-ignore-file no-import-prefix no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isValidUUID = (u: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("archivo") as File;
    const rawCourseId = formData.get("courseId") as string;
    const courseId = isValidUUID(rawCourseId) ? rawCourseId : null;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. BASE64 ROBUSTO (Fix Error 2345)
    const arrayBuffer = await file.arrayBuffer();
    const base64File = encode(arrayBuffer).replace(/\s+/g, ""); 
    const googleAccessToken = await getGoogleAccessToken();

    // 2. FUNCTION CALLING (Schema para students)
    const tools = [{
      function_declarations: [{
        name: "registrar_estudiantes",
        parameters: {
          type: "object",
          properties: {
            alumnos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  matricula: { type: "string" },
                  apellido_paterno: { type: "string" },
                  apellido_materno: { type: "string", nullable: true },
                  nombres: { type: "string" },
                  correo: { type: "string", nullable: true }
                },
                required: ["matricula", "apellido_paterno", "nombres"]
              }
            }
          },
          required: ["alumnos"]
        }
      }]
    }];

    const projectId = Deno.env.get("GOOGLE_PROJECT_ID");
    const url = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-3.0-pro:generateContent`;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Extrae los alumnos de este PDF." }, { inlineData: { mimeType: file.type, data: base64File } }] }],
        tools,
        tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["registrar_estudiantes"] } }
      })
    });

    const aiData = await aiRes.json();
    const extraction = aiData.candidates[0].content.parts[0].functionCall.args.alumnos;

    // 3. INSERCIÓN SQL
    const registros = extraction.map((est: any) => ({
      matricula: est.matricula,
      apellido_paterno: est.apellido_paterno,
      apellido_materno: est.apellido_materno || null,
      nombres: est.nombres,
      correo: est.correo || null,
      course_id: courseId
    }));

    const { data: dbData, error: dbError } = await supabase.from("students").insert(registros).select();
    if (dbError) throw dbError;

    // 4. SYNC CON SHEET (Proactivo)
    if (courseId && Deno.env.get("APPS_SCRIPT_URL")) {
      const { data: curso } = await supabase.from("courses").select("google_sheet_id, title, drive_folder_id").eq("id", courseId).single();
      
      let sheetId = curso?.google_sheet_id;

      if (!sheetId) {
        console.log("🛠️ Creando Sheet faltante...");
        const res = await fetch(Deno.env.get("APPS_SCRIPT_URL")!, {
          method: "POST",
          body: JSON.stringify({ action: "crearSoloSheet", payload: { folderId: curso?.drive_folder_id, nombreMateria: curso?.title } })
        });
        const data = await res.json();
        if (data.success) {
          sheetId = data.data.sheetId;
          await supabase.from("courses").update({ google_sheet_id: sheetId }).eq("id", courseId);
        }
      }

      if (sheetId) {
        for (const alumno of registros) {
          await fetch(Deno.env.get("APPS_SCRIPT_URL")!, {
            method: "POST",
            body: JSON.stringify({ action: "sincronizarAlumno", payload: { googleSheetId: sheetId, studentData: alumno, mode: "create" } })
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, count: dbData.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});

async function getGoogleAccessToken() {
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const pemContents = privateKeyPem!.substring(27, privateKeyPem!.length - 25).replace(/\s/g, '');
  const binaryDer = new Uint8Array(atob(pemContents).split("").map(c => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey("pkcs8", binaryDer.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"]);
  const now = getNumericDate(new Date());
  const jwt = await create({ alg: "RS256", typ: "JWT" }, { iss: clientEmail, sub: clientEmail, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600, scope: "https://www.googleapis.com/auth/cloud-platform" }, key);
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  return (await res.json()).access_token;
}