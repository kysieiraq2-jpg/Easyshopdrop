/* Fix59: server-side decisions. Screening never directly publishes photos. */
export const PHOTO_POLICY_VERSION = 'fix59-selective-v1';
const result = (action, reason, advanced = false) =>
  Object.freeze({ action, reason, advanced, policyVersion: PHOTO_POLICY_VERSION });

export function evaluateBasic({ text = '', textRegions = 0, lowConfidence = false, barcodeDetected = false } = {}) {
  const raw = String(text ?? '').normalize('NFKC');
  const normalized = raw.replace(/[\s().-]+/g, ' ');
  if (barcodeDetected) return result('reject', 'qr_or_barcode');
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw)) return result('reject', 'email_address');
  if (/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:co\.za|com|net|org|biz|info)\b)/i.test(raw)) return result('reject', 'website');
  if (/(?:\+\s?27|\b0)[\s().-]*(?:\d[\s().-]*){9}(?!\d)/.test(raw) || /\+\s?\d{1,3}[\s().-]*(?:\d[\s().-]*){8,12}(?!\d)/.test(raw)) return result('reject', 'telephone_number');
  if (/\b(?:whatsapp|call\s+me|phone\s+me|contact\s+us|dm\s+me|instagram|facebook|tiktok|telegram|snapchat)\b/i.test(normalized)) return result('reject', 'direct_contact');
  if (/(?:^|\s)@[a-z][a-z0-9_.]{3,}/i.test(raw)) return result('reject', 'social_handle');
  if (/\b\d{1,5}\s+(?:[a-z]+\s+){1,4}(?:street|road|avenue|drive|lane|boulevard|close|crescent|highway)\b/i.test(normalized)) return result('reject', 'street_address');
  const words = raw.match(/[\p{L}\p{N}]{2,}/gu) || [];
  if (words.length >= 3 || raw.trim().length >= 20) return result('reject', 'advertising_or_extended_text');
  // These signals trigger a second paid Vision request, not administrator review.
  if (lowConfidence || textRegions > 0 || raw.trim()) return result('advanced', 'ambiguous_or_short_text', true);
  return result('basic_pass', 'no_text_detected');
}

export function evaluateAdvanced({ text = '', logos = [], unreadable = false, barcodeDetected = false } = {}) {
  if (barcodeDetected) return result('reject', 'qr_or_barcode', true);
  const repeat = evaluateBasic({ text, textRegions: 0, lowConfidence: false });
  if (repeat.action === 'reject') return result('reject', repeat.reason, true);
  if (!Array.isArray(logos) || logos.some(x => String(x || '').trim()))
    return result('reject', 'logo_or_promotional_mark', true);
  // Strict default: ambiguous writing cannot bypass screening.
  if (unreadable || repeat.action === 'advanced') return result('reject', 'unverified_or_hidden_writing', true);
  return result('advanced_pass', 'advanced_check_clear', true);
}
