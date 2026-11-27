
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "SHOPDROP-R12C-V5";

const env = (name: string) =>
  Deno.env.get(name)?.trim() ?? "";

function reply(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify({ version: VERSION, ...data }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

function secureEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let difference = x.length ^ y.length;

  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }

  return difference === 0;
}

const allowedTypes = new Set([
  "order_created",
  "payment_confirmed",
  "payment_failed",
  "payment_cancelled",
  "payment_expired",
  "courier_booked",
  "shipment_dispatched",
  "shipment_in_transit",
  "shipment_delivered",
  "delivery_verified",
  "payout_eligible",
  "payout_submitted",
  "payout_completed",
  "payout_failed",
  "service_booked",
  "service_arrival_pin",
  "service_arrival_verified",
  "dispatch_booked",
  "dispatch_arrival_verified",
  "refund_requested",
  "refund_completed",
  "dispute_opened",
  "dispute_updated",
  "account_notice",
]);

type OutboxMessage = {
  id: string;
  user_id: string;
  event_key: string;
  channel: string;
  notification_type: string;
  subject: string | null;
  message_body: string;
  attempt_count: number;
  max_attempts: number;
};

type DeliveryResult = {
  provider: string;
  providerId: string;
};

class DeliveryError extends Error {
  uncertain: boolean;
  permanent: boolean;

  constructor(
    message: string,
    uncertain = false,
    permanent = false,
  ) {
    super(message);
    this.uncertain = uncertain;
    this.permanent = permanent;
  }
}

function validPhone(value: unknown): string | null {
  const phone = String(value ?? "").trim();

  return /^\+[1-9]\d{7,14}$/.test(phone)
    ? phone
    : null;
}

async function sendEmail(
  email: string,
  message: OutboxMessage,
): Promise<DeliveryResult> {
  const key = env("SHOPDROP_RESEND_API_KEY");
  const from = env("SHOPDROP_EMAIL_FROM");

  if (!key || !from) {
    throw new DeliveryError(
      "email_provider_not_configured",
      false,
      true,
    );
  }

  let response: Response;

  try {
    response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.id,
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject:
            message.subject || "Shop&Drop notification",
          text: message.message_body,
        }),
      },
    );
  } catch {
    throw new DeliveryError(
      "email_delivery_uncertain",
      true,
    );
  }

  if (!response.ok) {
    throw new DeliveryError(
      `email_provider_http_${response.status}`,
      response.status >= 500 ||
        response.status === 429,
      response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429,
    );
  }

  const result = await response.json()
    .catch(() => ({}));

  if (!result.id) {
    throw new DeliveryError(
      "email_response_uncertain",
      true,
    );
  }

  return {
    provider: "resend",
    providerId: String(result.id),
  };
}

async function sendWhatsApp(
  phone: string,
  _message: OutboxMessage,
): Promise<DeliveryResult> {
  const token =
    env("SHOPDROP_WHATSAPP_ACCESS_TOKEN");

  const phoneId =
    env("SHOPDROP_WHATSAPP_PHONE_NUMBER_ID");

  const template =
    env("SHOPDROP_WHATSAPP_TEMPLATE_NAME");

  const language =
    env("SHOPDROP_WHATSAPP_TEMPLATE_LANGUAGE") ||
    "en";

  if (!token || !phoneId || !template) {
    throw new DeliveryError(
      "whatsapp_provider_not_configured",
      false,
      true,
    );
  }

  if (!/^[a-z0-9_]+$/.test(template)) {
    throw new DeliveryError(
      "invalid_whatsapp_template",
      false,
      true,
    );
  }

  const apiVersion =
    env("SHOPDROP_WHATSAPP_API_VERSION") ||
    "v23.0";

  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new DeliveryError(
      "invalid_whatsapp_api_version",
      false,
      true,
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace("+", ""),
          type: "template",
          template: {
            name: template,
            language: { code: language },
          },
        }),
      },
    );
  } catch {
    throw new DeliveryError(
      "whatsapp_delivery_uncertain",
      true,
    );
  }

  if (!response.ok) {
    throw new DeliveryError(
      `whatsapp_provider_http_${response.status}`,
      response.status >= 500 ||
        response.status === 429,
      response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429,
    );
  }

  const result = await response.json()
    .catch(() => ({}));

  const id = result.messages?.[0]?.id;

  if (!id) {
    throw new DeliveryError(
      "whatsapp_response_uncertain",
      true,
    );
  }

  return {
    provider: "meta_whatsapp",
    providerId: String(id),
  };
}

// R12C-V5 AUTOMATIC WORKER AUTHENTICATION
//
// The worker credential was already generated
// and stored securely inside Supabase Vault.
//
// The scheduler will read it internally.
//
// No owner-generated secret is required.
//
// Authentication fails closed if the credential
// or protected verification function is missing.

async function authenticateWorker(
  request: Request,
  admin: ReturnType<typeof createClient>,
  serviceKey: string,
): Promise<boolean> {
  const authorization =
    request.headers.get("Authorization") ?? "";

  const bearerPrefix = "Bearer ";

  const suppliedServiceKey =
    authorization.startsWith(bearerPrefix)
      ? authorization.slice(bearerPrefix.length).trim()
      : "";

  // Preserve existing authorized service-role calls.
  if (
    suppliedServiceKey &&
    secureEqual(suppliedServiceKey, serviceKey)
  ) {
    return true;
  }

  // Dedicated scheduled-worker authentication.
  const workerToken =
    request.headers.get(
      "x-shopdrop-worker-token",
    )?.trim() ?? "";

  if (!/^[a-f0-9]{64}$/.test(workerToken)) {
    return false;
  }

  try {
    const { data, error } = await admin.rpc(
      "verify_shopdrop_worker",
      {
        supplied_token: workerToken,
      },
    );

    if (error) {
      console.error(
        "Worker verification unavailable:",
        error.message,
      );
      return false;
    }

    return data === true;
  } catch (error) {
    console.error(
      "Worker verification failed:",
      error,
    );
    return false;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return reply({
      ok: false,
      error: "method_not_allowed",
    }, 405);
  }

  const url = env("SUPABASE_URL");
  const serviceKey =
    env("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    return reply({
      ok: false,
      error: "backend_not_configured",
    }, 503);
  }

  const admin = createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const authorized = await authenticateWorker(
    request,
    admin,
    serviceKey,
  );

  if (!authorized) {
    return reply({
      ok: false,
      error: "unauthorized",
    }, 401);
  }

  // Messaging remains disabled until providers
  // and the scheduler have been verified.
  if (
    env("SHOPDROP_MESSAGING_ENABLED") !== "true"
  ) {
    return reply({
      ok: true,
      enabled: false,
      claimed: 0,
      sent: 0,
      failed: 0,
      held: 0,
    });
  }

  const { data: messages, error: claimError } =
    await admin.rpc(
      "claim_outbox_messages",
      {
        p_limit: 5,
      },
    );

  if (claimError) {
    console.error(
      "Outbox claim error:",
      claimError.message,
    );

    return reply({
      ok: false,
      error: "outbox_claim_failed",
    }, 500);
  }

  let sent = 0;
  let failed = 0;
  let held = 0;

  for (
    const message of
    (messages ?? []) as OutboxMessage[]
  ) {
    let providerAccepted = false;

    async function updateStatus(
      fields: Record<string, unknown>,
    ): Promise<void> {
      const result = await admin
        .from("message_outbox")
        .update({
          ...fields,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", message.id)
        .eq("status", "processing")
        .select("id");

      if (result.error) {
        throw new Error(
          `outbox_update_failed:${result.error.message}`,
        );
      }

      if (!result.data?.length) {
        throw new Error(
          "outbox_status_not_updated",
        );
      }
    }

    try {
      if (
        !allowedTypes.has(
          message.notification_type,
        )
      ) {
        throw new DeliveryError(
          "unsupported_notification_type",
          false,
          true,
        );
      }

      const {
        data: userData,
        error: userError,
      } = await admin.auth.admin.getUserById(
        message.user_id,
      );

      if (userError || !userData?.user) {
        throw new DeliveryError(
          "recipient_not_found",
          false,
          true,
        );
      }

      const user = userData.user;

      if (message.channel === "email") {
        if (
          env("SHOPDROP_EMAIL_ENABLED") !== "true"
        ) {
          throw new DeliveryError(
            "email_not_enabled",
            false,
            true,
          );
        }

        const {
          data: preferences,
          error: prefError,
        } = await admin
          .from("notification_preferences")
          .select("email_enabled")
          .eq("user_id", message.user_id)
          .maybeSingle();

        if (prefError) {
          throw new DeliveryError(
            "email_preferences_unavailable",
          );
        }

        if (
          preferences?.email_enabled === false
        ) {
          await updateStatus({
            status: "cancelled",
            last_error:
              "email_disabled_by_user",
          });

          held++;
          continue;
        }

        if (
          !user.email ||
          !user.email_confirmed_at
        ) {
          throw new DeliveryError(
            "verified_email_required",
            false,
            true,
          );
        }

        const result = await sendEmail(
          user.email,
          message,
        );

        providerAccepted = true;

        await updateStatus({
          status: "sent",
          provider_code: result.provider,
          provider_message_id:
            result.providerId,
          sent_at:
            new Date().toISOString(),
          last_error: null,
        });

        sent++;
      } else if (
        message.channel === "whatsapp"
      ) {
        if (
          env("SHOPDROP_WHATSAPP_ENABLED") !==
          "true"
        ) {
          throw new DeliveryError(
            "whatsapp_not_enabled",
            false,
            true,
          );
        }

        // Consent is checked from trusted
        // server-side account metadata.
        const metadata =
          user.app_metadata ?? {};

        if (
          metadata.shopdrop_whatsapp_opt_in !==
          true
        ) {
          await updateStatus({
            status: "cancelled",
            last_error:
              "whatsapp_consent_missing",
          });

          held++;
          continue;
        }

        const phone = validPhone(
          user.phone,
        );

        if (
          !phone ||
          !user.phone_confirmed_at
        ) {
          throw new DeliveryError(
            "verified_whatsapp_phone_required",
            false,
            true,
          );
        }

        const result = await sendWhatsApp(
          phone,
          message,
        );

        providerAccepted = true;

        await updateStatus({
          status: "sent",
          provider_code: result.provider,
          provider_message_id:
            result.providerId,
          sent_at:
            new Date().toISOString(),
          last_error: null,
        });

        sent++;
      } else {
        throw new DeliveryError(
          "unsupported_channel",
          false,
          true,
        );
      }
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "unknown_delivery_error";

      const uncertain =
        providerAccepted ||
        (
          error instanceof DeliveryError &&
          error.uncertain
        );

      // A provider may have accepted the message.
      // Do not automatically resend an uncertain
      // delivery and risk duplicate notifications.
      if (uncertain) {
        try {
          await updateStatus({
            status: "failed",
            last_error:
              `reconciliation_required:${reason}`,
          });
        } catch (statusError) {
          console.error(
            "Unresolved outbox:",
            message.id,
            statusError,
          );
        }

        held++;
        continue;
      }

      const attempts = Number(
        message.attempt_count || 1,
      );

      const maximum = Number(
        message.max_attempts || 5,
      );

      const permanent =
        error instanceof DeliveryError &&
        error.permanent;

      const retry =
        !permanent &&
        attempts < maximum;

      try {
        await updateStatus({
          status:
            retry ? "pending" : "failed",
          last_error: reason,
          next_attempt_at:
            new Date(
              Date.now() +
              Math.min(
                60,
                2 ** Math.min(attempts, 6),
              ) * 60000,
            ).toISOString(),
        });
      } catch (statusError) {
        console.error(
          "Unresolved outbox:",
          message.id,
          statusError,
        );
      }

      failed++;
    }
  }

  return reply({
    ok: true,
    enabled: true,
    claimed: messages?.length ?? 0,
    sent,
    failed,
    held,
  });
});
