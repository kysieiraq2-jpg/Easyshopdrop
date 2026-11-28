import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const VERSION = "SHOPDROP-PHOTO-SCREEN-V140B";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (body: Record<string, unknown>, status=200) =>
  new Response(JSON.stringify({version: VERSION, ...body}), {status, headers});
function actualMime(b: Uint8Array): string | null {
  if (b.length>=3 && b[0]===255 && b[1]===216 && b[2]===255) return "image/jpeg";
  if (b.length>=8 && [137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)) return "image/png";
  if (b.length>=12 && new TextDecoder().decode(b.slice(0,4))==="RIFF" &&
      new TextDecoder().decode(b.slice(8,12))==="WEBP") return "image/webp";
  return null;
}
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers});
  if (req.method!=="POST") return reply({ok:false,error:"method_not_allowed"},405);
  if (!URL || !ANON || !SERVICE) return reply({ok:false,error:"not_configured"},503);
  const bearer=req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(bearer)) return reply({ok:false,error:"sign_in_required"},401);
  const userClient=createClient(URL,ANON,{
    global:{headers:{Authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:identity,error:authError}=await userClient.auth.getUser();
  if (authError || !identity.user?.id || identity.user.is_anonymous===true)
    return reply({ok:false,error:"sign_in_required"},401);
  let payload: Record<string,unknown>;
  try {
    const value=await req.json();
    if (!value || typeof value!=="object" || Array.isArray(value)) throw Error("invalid");
    payload=value;
  } catch {return reply({ok:false,error:"invalid_json"},400);}
  const productId=typeof payload.product_id==="string"?payload.product_id:"";
  if (!uuid.test(productId)) return reply({ok:false,error:"invalid_product"},400);
  const admin=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:product,error:productError}=await admin.from("products")
    .select("id,seller_id,listing_status").eq("id",productId).maybeSingle();
  if(productError) return reply({ok:false,error:"product_lookup_failed"},503);
  if(!product || product.seller_id!==identity.user.id) return reply({ok:false,error:"not_owner"},403);
  if(product.listing_status!=="pending") return reply({ok:false,error:"listing_not_pending"},409);
  const {data:images,error:imageError}=await admin.from("listing_images")
    .select("id,product_id,storage_bucket,storage_path,mime_type,file_size_bytes")
    .eq("product_id",productId).order("image_position",{ascending:true});
  if(imageError) return reply({ok:false,error:"image_lookup_failed"},503);
  if(!images || images.length<1 || images.length>6) return reply({ok:false,error:"invalid_image_count"},400);
  const results=[];
  for(const image of images){
    if(image.storage_bucket!=="listing-images" ||
       typeof image.storage_path!=="string" ||
       !image.storage_path.startsWith(identity.user.id+"/") ||
       !Number.isFinite(Number(image.file_size_bytes)) ||
       Number(image.file_size_bytes)<1 ||
       Number(image.file_size_bytes)>10485760){
      return reply({ok:false,error:"image_metadata_invalid"},409);
    }
    const {data:blob,error:downloadError}=await admin.storage
      .from("listing-images").download(image.storage_path);
    if(downloadError || !blob) return reply({ok:false,error:"image_download_failed"},503);
    if(blob.size<1 || blob.size>10485760) return reply({ok:false,error:"image_size_invalid"},409);
    const mime=actualMime(new Uint8Array(await blob.slice(0,16).arrayBuffer()));
    const valid=Boolean(mime && mime===image.mime_type);
    // Server-side byte validation is NOT OCR. Never issue a pass verdict.
    const status=valid?"review":"reject";
    const reason=valid?"ocr_not_yet_available_on_server":"image_signature_mismatch";
    const {error:saveError}=await admin.from("shopdrop_photo_screening_results")
      .upsert({
        listing_image_id:image.id,
        product_id:productId,
        storage_path:image.storage_path,
        status,
        reason_code:reason,
        engine_version:VERSION,
        scanned_at:new Date().toISOString()
      },{onConflict:"listing_image_id"});
    if(saveError) return reply({ok:false,error:"screening_record_failed"},503);
    results.push({image_id:image.id,status,reason_code:reason});
  }
  return reply({
    ok:true,
    publication_gate_enabled:false,
    ocr_completed:false,
    results
  });
});