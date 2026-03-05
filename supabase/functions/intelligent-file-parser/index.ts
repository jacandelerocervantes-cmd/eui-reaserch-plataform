// deno-lint-ignore-file no-import-prefix no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = encode(arrayBuffer).replace(/\s+/g, "");

    const googleAccessToken = await getGoogleAccessToken();
    const projectId = Deno.env.get("GOOGLE_PROJECT_ID");
    const url = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-3.0-pro:generateContent`;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${googleAccessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Analiza el Syllabus y extrae estructura JSON." }, { inlineData: { mimeType: file.type, data: base64Data } }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    const aiData = await aiRes.json();
    const cleanJson = aiData.candidates[0].content.parts[0].text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return new Response(JSON.stringify({ success: true, data: JSON.parse(cleanJson) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
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