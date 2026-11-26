
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Error("UNAUTHORIZED");

  const supabase = adminClient();
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user || data.user.is_anonymous === true) throw new Error("UNAUTHORIZED");
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

  if (req.method !== "POST") return json({ok:false,code:"method_not_allowed",user_message:"POST required."},405);
  try {
    const u = await requireUser(req);
    const b = await req.json();
    if (!b || typeof b !== "object" || Array.isArray(b)) return json({ok:false,user_message:"Invalid request."},400);
    const db = adminClient();

    // Fix 199B: resolve the real listing and create one report/admin case.
    const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0,max) : "";
    const { data, error } = await db.rpc("shopdrop_submit_listing_report_199b", {
      p_user_id: u.id,
      p_kind: clean(b.listing_type ?? b.kind,40),
      p_reference: clean(b.listing_reference ?? b.reference ?? b.listing_id,100),
      p_reason: clean(b.reason,500),
      p_details: clean(b.details,3000),
    });
    if (error) {
      console.error("SHOPDROP-199B listing report", error.code);
      return json({ok:false,code:"report_failed",user_message:"Listing report could not be submitted."},500);
    }
    if (data?.ok !== true || typeof data.reference !== "string" || typeof data.report_id !== "string") {
      return json({ok:false,code:"invalid_report",user_message:data?.error || "Check the listing and report details."},400);
    }
    return json(data);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return json({
        code: "unauthorized",
        user_message: "Authentication required."
      }, 401);
    }

    return json({
      code: "report_failed",
      user_message: "Listing report could not be submitted."
    }, 400);
  }
});

