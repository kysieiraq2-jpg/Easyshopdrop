import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-QUICK-LIST-V1";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
function respond(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ version: VERSION, ...data }), { status, headers: CORS });
}
function text(v: unknown) { return typeof v === "string" ? v.trim() : ""; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respond({ ok:false, error:"method_not_allowed" }, 405);
  if (!URL || !PUBLIC_KEY || !SERVICE_KEY) return respond({ ok:false, error:"provider_not_configured" }, 503);

  const authorization = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return respond({ ok:false, error:"sign_in_required" }, 401);
  }
  const userClient = createClient(URL, PUBLIC_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession:false, autoRefreshToken:false }
  });
  const { data:who, error:authError } = await userClient.auth.getUser();
  if (authError || !who.user?.id || who.user.is_anonymous === true) {
    return respond({ ok:false, error:"sign_in_required" }, 401);
  }
  let body: unknown;
  try { body = await req.json(); }
  catch { return respond({ ok:false, error:"invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return respond({ ok:false, error:"invalid_request" }, 400);
  }
  const id = text((body as Record<string,unknown>).product_id);
  if (!UUID.test(id)) return respond({ ok:false, error:"invalid_product" }, 400);

  const admin = createClient(URL, SERVICE_KEY, {
    auth: { persistSession:false, autoRefreshToken:false }
  });
  const { data:product, error:pError } = await admin.from("products")
    .select("id,seller_id,title,description,category,condition,price,currency,country_code,quantity,listing_status,listing_reference")
    .eq("id", id).maybeSingle();

  if (pError) return respond({ ok:false, error:"product_lookup_failed" }, 503);
  if (!product || product.seller_id !== who.user.id) {
    return respond({ ok:false, error:"product_not_owned_by_account" }, 403);
  }
  if (!["pending","active"].includes(text(product.listing_status))) {
    return respond({ ok:false, error:"listing_locked_for_exception_review" }, 409);
  }
  // No manual seller application, personal identity or bank-account approval
  // is required to advertise. A previously suspended account stays blocked.
  const { data:verification, error:verifyError } = await admin
    .from("seller_verification_status")
    .select("suspended_at")
    .eq("seller_id", who.user.id).maybeSingle();
  if (verifyError) return respond({ ok:false, error:"account_safety_check_unavailable" }, 503);
  if (verification?.suspended_at) {
    return respond({ ok:false, error:"account_suspended" }, 403);
  }

  if (
    text(product.title).length < 2 ||
    text(product.description).length < 10 ||
    text(product.category).length < 2 ||
    !(Number(product.price)>0) ||
    !Number.isSafeInteger(Number(product.quantity)) ||
    Number(product.quantity) < 1 ||
    product.currency !== "ZAR" ||
    product.country_code !== "ZA"
  ) return respond({ ok:false, error:"item_details_incomplete" }, 400);

  // Sellers' private contact details must not be copied into public adverts.
  const listingWords = text(product.title)+" "+text(product.description);
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(listingWords) ||
    /(?:\+27|0)[\s-]?[6-8](?:[\s-]?\d){8}/.test(listingWords)) {
    return respond({ ok:false, error:"remove_private_contact_details_from_advert" }, 400);
  }
  const { data:images, error:iError } = await admin
    .from("listing_images")
    .select("image_position,is_primary,storage_bucket,storage_path,mime_type,file_size_bytes")
    .eq("product_id", id).order("image_position", { ascending:true });
  if (iError || !images || images.length < 1 || images.length > 6) {
    return respond({ ok:false, error:"one_to_six_photographs_required" }, 400);
  }
  for (let index=0; index<images.length; index++) {
    const image = images[index];
    const path = text(image.storage_path);
    const parts = path.split("/");
    if (Number(image.image_position) !== index+1 ||
        image.storage_bucket !== "listing-images" ||
        image.is_primary !== (index === 0) ||
        !MIMES.has(text(image.mime_type)) ||
        parts.length !== 3 ||
        parts[0] !== who.user.id ||
        !/^[A-Za-z0-9_-]{1,120}$/.test(parts[1]) ||
        !/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(parts[2]) ||
        Number(image.file_size_bytes) <= 0 ||
        Number(image.file_size_bytes) > 10 * 1024 * 1024) {
      return respond({ ok:false, error:"photograph_record_invalid" }, 400);
    }
    const folder = parts[0]+"/"+parts[1];
    // Validate the actual stored object instead of trusting a seller-inserted
    // image metadata row. No seller may publish an absent or foreign image.
    const { data:stored, error:storageError } = await admin.storage
      .from("listing-images").list(folder, { search:parts[2], limit:100 });
    if (storageError) return respond({ ok:false, error:"photo_storage_unavailable" }, 503);
    if (!(stored||[]).some(f=>f.name===parts[2] && Number(f.metadata?.size || 0)>0)) {
      return respond({ ok:false, error:"photograph_upload_incomplete" }, 409);
    }
  }

  if (product.listing_status === "active") {
    return respond({ ok:true, published:true, already_published:true,
      listing_reference:product.listing_reference, payment_enabled:false, funds_moved:false });
  }

  // Trusted server-only status transition; seller cannot approve by editing
  // the database from the browser. No payout/checkout permissions are changed.
  const { data:published, error:publishError } = await admin.from("products")
    .update({ listing_status:"active" })
    .eq("id", id).eq("seller_id", who.user.id)
    .eq("listing_status", "pending")
    .select("id,listing_reference,listing_status").maybeSingle();

  if (publishError || !published || published.listing_status !== "active") {
    return respond({ ok:false, error:"publication_not_confirmed" }, 409);
  }
  return respond({ ok:true, published:true, listing_reference:published.listing_reference,
    payment_enabled:false, funds_moved:false });
});