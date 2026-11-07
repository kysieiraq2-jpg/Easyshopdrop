
// SHOPDROP-FIX32B: provider-neutral, fail-closed verification boundary.
// Existing payment-webhook and all payment state remain untouched.
type VerifiedProviderEvent = Readonly<{
  providerCode: string;
  eventId: string;
  eventType: string;
  providerPaymentReference: string;
  currency: string;
  amountMinorUnits: bigint;
  verifiedAt: string;
  rawPayloadSha256: string;
}>;
type ProviderVerifier = (
  rawBody: Uint8Array,
  headers: Headers,
  secret: string,
) => Promise<VerifiedProviderEvent | null>;

const MAX_BODY_BYTES = 262144;
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

// Intentionally empty: adding a provider requires its published signature
// algorithm, secure secret provisioning, replay checks and verified test vectors.
const verifiers: Readonly<Record<string, ProviderVerifier>> = Object.freeze({});

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    reader.releaseLock();
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return reply({ ok: false, error: "post_required" }, 405);
  }
  const lengthHeader = request.headers.get("content-length");
  const declaredLength = lengthHeader === null ? null : Number(lengthHeader);
  if (declaredLength !== null &&
      (!Number.isSafeInteger(declaredLength) ||
       declaredLength < 0 || declaredLength > MAX_BODY_BYTES)) {
    return reply({ ok: false, error: "payload_too_large" }, 413);
  }

  // No provider configured. Reject before reading or interpreting an event.
  // Never select a verifier using an untrusted provider name from the body.
  if (Object.keys(verifiers).length === 0) {
    return reply({
      ok: false,
      code: "provider_verifier_not_configured",
      payment_status_changed: false,
      provider_event_recorded: false,
      funds_moved: false,
    }, 503);
  }

  // Reserved for future provider-specific route mapping and signature checks.
  // Raw bytes must be verified BEFORE JSON parsing, audit registration or
  // payment-leg changes. Never treat a database event audit as verification.
  void readBoundedBody;
  return reply({ ok: false, code: "provider_verification_unavailable" }, 503);
});

