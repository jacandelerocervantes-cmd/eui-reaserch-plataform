// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validador estricto de UUID para evitar el error de "prueba"
const isValidUUID = (u: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(u);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("archivo") as File;
    const rawCourseId = formData.get("courseId") as string;

    console.log(` Iniciando: Archivo ${file?.name}, CourseID: ${rawCourseId}`);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Validamos el UUID. Si es "prueba", lo enviamos como null para no romper la DB
    const courseId = isValidUUID(rawCourseId) ? rawCourseId : null;

    // 1. Preparar archivo para Gemini 3.0 Pro
    const arrayBuffer = await file.arrayBuffer();
    const base64File = encode(new Uint8Array(arrayBuffer)).replace(/\s+/g, ""); 
    const googleAccessToken = await getGoogleAccessToken();

    // 2. Prompt optimizado para tu tabla SQL (nombres, apellido_paterno, apellido_materno)
    const prompt = `Extrae de esta lista: matricula, apellido_paterno, apellido_materno, nombres. 
    Formato JSON: {"estudiantes": [{"matricula": "str", "apellido_paterno": "str", "apellido_materno": "str"|null, "nombres": "str"}]}`;

    const projectId = Deno.env.get("GOOGLE_PROJECT_ID");
    const url = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-3.0-pro:generateContent`;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64File } }] }]
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(`Google Error: ${JSON.stringify(aiData)}`);

    let texto = aiData.candidates[0].content.parts[0].text;
    const resultadoIA = JSON.parse(texto.replace(/```json/g, "").replace(/```/g, "").trim());

    // 3. Mapeo exacto a las columnas de tu tabla public.students
    const registros = resultadoIA.estudiantes.map((est: any) => ({
      matricula: est.matricula || "S/M",
      apellido_paterno: est.apellido_paterno || "S/P",
      apellido_materno: est.apellido_materno || null,
      nombres: est.nombres || "Sin Nombre",
      course_id: courseId, // Usamos el UUID validado o null
      correo: est.correo || null
    }));

    console.log(`💾 Insertando ${registros.length} alumnos en la tabla students...`);

    const { data: insertData, error: dbError } = await supabase
      .from("students") 
      .insert(registros)
      .select();

    if (dbError) throw new Error(`Error BD: ${dbError.message}`);

    return new Response(JSON.stringify({ success: true, count: insertData.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error(`🚨 FALLO CRÍTICO: ${error.message}`);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

async function getGoogleAccessToken() {
  const privateKeyPem = Deno.env.get("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const pemContents = privateKeyPem!.substring(27, privateKeyPem!.length - 25).replace(/\s/g, '');
  const binaryDer = new Uint8Array(atob(pemContents).split("").map(c => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey("pkcs8", binaryDer.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["sign"]);
  const now = getNumericDate(new Date());
  const jwt = await create({ alg: "RS256", typ: "JWT" }, {
    iss: clientEmail, sub: clientEmail, aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600, scope: "https://www.googleapis.com/auth/cloud-platform",
  }, key);
  const res = await fetch("https://oauth2.googleapis.com/token", { 
    method: "POST", 
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) 
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Auth Error: ${data.error_description}`);
  return data.access_token;
}