/* Fix59 PREPARATION ONLY. No deployment or live photo changes.
   Requires a private upload bucket, independent barcode scan,
   and a verified server-only publication gate before activation. */
import { evaluateBasic, evaluateAdvanced } from '../_shared/shopdrop-photo-policy.mjs';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imagePath = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,120}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;

async function equalSecret(actual: string, expected: string) {
  if (!actual || !expected) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([actual, expected].map(async x =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(x)))));
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}
function base64(bytes: Uint8Array) {
  let str = '';
  for (let i = 0; i < bytes.length; i += 8192)
    str += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(str);
}
async function vision(key: string, bytes: Uint8Array, features: string[]) {
  const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: { 'content-type':'application/json', 'x-goog-api-key':key },
    body: JSON.stringify({ requests: [{
      image: { content: base64(bytes) },
      features: features.map(type => ({ type }))
    }] })
  });
  if (!response.ok) throw Error('vision_unavailable');
  const data = await response.json();
  const scan = data?.responses?.[0];
  if (!scan || scan.error) throw Error('vision_error');
  return scan;
}
function scanText(scan: any) {
  return String(scan?.fullTextAnnotation?.text || scan?.textAnnotations?.[0]?.description || '');
}
function lowConfidence(scan: any) {
  const blocks = (scan?.fullTextAnnotation?.pages || []).flatMap((p: any) => p.blocks || []);
  return blocks.some((b: any) => typeof b.confidence === 'number' && b.confidence < 0.70);
}
Deno.serve(async req => {
  if (req.method !== 'POST') return json({error:'method_not_allowed'},405);
  const secret = Deno.env.get('SHOPDROP_PHOTO_WORKER_SECRET') || '';
  if (!await equalSecret(req.headers.get('x-shopdrop-photo-worker-secret') || '',secret))
    return json({error:'unauthorized'},401);
  if (Deno.env.get('SHOPDROP_PHOTO_SCANNING_ENABLED') !== 'true')
    return json({error:'screening_not_activated'},503);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const googleKey = Deno.env.get('SHOPDROP_GOOGLE_VISION_API_KEY') || '';
  if (!url || !serviceKey || !googleKey) return json({error:'scanner_not_configured'},503);

  let body: any;
  try { body = await req.json(); } catch { return json({error:'bad_json'},400); }
  const owner = String(body?.owner_id || '').toLowerCase();
  const path = String(body?.storage_path || '');
  const listingType = String(body?.listing_type || '');
  if (!uuid.test(owner) || !imagePath.test(path) || !path.toLowerCase().startsWith(owner + '/') ||
      !['product','service','dispatch'].includes(listingType))
    return json({error:'invalid_scan_job'},400);
  const auth = { apikey: serviceKey, authorization: 'Bearer ' + serviceKey };
  const storageUrl = new URL('/storage/v1/object/authenticated/shopdrop-photo-pending/' +
    path.split('/').map(encodeURIComponent).join('/'), url);

  let bytes: Uint8Array;
  try {
    const response = await fetch(storageUrl, { headers: auth });
    if (!response.ok) return json({error:'staged_photo_unavailable'},503);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > 6*1024*1024) return json({error:'photo_requires_resizing'},422);
    bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 6*1024*1024)
      return json({error:'photo_requires_resizing'},422);
  } catch { return json({error:'photo_read_failed'},503); }

  let preliminary: any;
  let advancedResult: any = null;
  try {
    // Lower-cost screening: every image receives TEXT_DETECTION only.
    const first = await vision(googleKey, bytes, ['TEXT_DETECTION']);
    preliminary = evaluateBasic({
      text: scanText(first),
      textRegions: Array.isArray(first.textAnnotations) ? Math.max(0, first.textAnnotations.length - 1) : 0,
      lowConfidence: lowConfidence(first)
    });
    if (preliminary.action === 'advanced') {
      // Only the ambiguous subset incurs these additional features.
      const deep = await vision(googleKey, bytes, ['DOCUMENT_TEXT_DETECTION','LOGO_DETECTION']);
      advancedResult = evaluateAdvanced({
        text: scanText(deep),
        logos: (deep.logoAnnotations || []).map((x: any) => x.description || ''),
        unreadable: lowConfidence(deep)
      });
    }
  } catch { return json({error:'scanning_unavailable',decision:'hold_private'},503); }

  const finalResult = advancedResult || preliminary;
  const verdict = finalResult.action === 'reject' ? 'reject' : 'pending_barcode';
  // An independent barcode/QR test AND a server-side publication
  // authorization gate are not installed. No accepted public uploads.
  const row = {
    owner_id: owner,
    storage_bucket: 'shopdrop-photo-pending',
    storage_path: path,
    listing_type: listingType,
    scan_decision: verdict,
    reason_code: finalResult.reason,
    policy_version: finalResult.policyVersion,
    advanced_used: Boolean(advancedResult),
    barcode_verified: false,
    scanned_at: new Date().toISOString()
  };
  try {
    const response = await fetch(new URL('/rest/v1/shopdrop_photo_scan_results?on_conflict=storage_bucket,storage_path',url),{
      method:'POST',
      headers:{...auth,'content-type':'application/json','prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(row)
    });
    if (!response.ok) return json({error:'scan_record_not_saved'},503);
  } catch { return json({error:'scan_record_not_saved'},503); }
  return json({
    decision: verdict === 'reject' ? 'replace_photo' : 'pending_barcode_check',
    reason: finalResult.reason,
    advanced_ai_used: Boolean(advancedResult)
  });
});
