import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Error("UNAUTHORIZED");

  const supabase = adminClient();
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return data.user;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const u = await requireUser(req);
    const b = await req.json();
    const db = adminClient();
    const ref = `EVD-${crypto.randomUUID()}`;

    const { error } = await db.from("integration_events").insert({
      event_type: "dispute_evidence_metadata",
      external_reference: ref,
      payload: { ...b, user_id: u.id },
      status: "awaiting_signed_upload"
    });

    if (error) throw error;

    return json({
      ok: true,
      reference: ref,
      status: "awaiting_signed_upload"
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return json({
        code: "unauthorized",
        user_message: "Authentication required."
      }, 401);
    }

    return json({
      code: "evidence_failed",
      user_message: "Evidence metadata could not be submitted."
    }, 400);
  }
});