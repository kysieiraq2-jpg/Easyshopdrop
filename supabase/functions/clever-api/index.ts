
const VERSION = "SHOPDROP-CLEVER-API-INACTIVE-V1";

Deno.serve((_req) => {
  return new Response(
    JSON.stringify({
      ok: false,
      active: false,
      endpoint: "clever-api",
      status: "inactive",
      reason: "legacy_endpoint_not_currently_required",
      version: VERSION,
    }),
    {
      status: 410,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
});

