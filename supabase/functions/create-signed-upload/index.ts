
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uploadTypes: Record<
  string,
  {
    bucket: string;
    maxSize: number;
    allowedMimeTypes: string[];
  }
> = {
  listing_image: {
    bucket: "listing-images",
    maxSize: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },

  dispute_evidence: {
    bucket: "dispute-evidence",
    maxSize: 20 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },

  proof_of_delivery: {
    bucket: "proof-of-delivery",
    maxSize: 20 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
  },

  provider_document: {
    bucket: "provider-documents",
    maxSize: 20 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
  },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function extensionForMime(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        code: "method_not_allowed",
        user_message: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json(
        {
          code: "unauthorized",
          user_message: "Authentication required.",
        },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment configuration.");
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const token = authHeader.replace(/^Bearer\s+/i, "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json(
        {
          code: "unauthorized",
          user_message: "Authentication required.",
        },
        401,
      );
    }

    const body = await req.json();

    const uploadType =
      typeof body?.upload_type === "string"
        ? body.upload_type.trim()
        : "";

    const reference =
      typeof body?.reference === "string"
        ? body.reference.trim()
        : "";

    const mimeType =
      typeof body?.mime_type === "string"
        ? body.mime_type.toLowerCase().trim()
        : "";

    const fileSize = Number(body?.file_size);

    const config = uploadTypes[uploadType];

    if (!config) {
      return json(
        {
          code: "invalid_upload_type",
          user_message: "Unsupported upload type.",
        },
        400,
      );
    }

    if (
      !reference ||
      reference.length > 120 ||
      !/^[A-Za-z0-9_-]+$/.test(reference)
    ) {
      return json(
        {
          code: "invalid_reference",
          user_message: "Invalid Shop&Drop reference.",
        },
        400,
      );
    }

    if (!config.allowedMimeTypes.includes(mimeType)) {
      return json(
        {
          code: "unsupported_file_type",
          user_message: "This file type is not supported.",
        },
        400,
      );
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > config.maxSize
    ) {
      return json(
        {
          code: "invalid_file_size",
          user_message: "The selected file is too large or invalid.",
        },
        400,
      );
    }

    const extension = extensionForMime(mimeType);

    if (!extension) {
      return json(
        {
          code: "unsupported_file_type",
          user_message: "This file type is not supported.",
        },
        400,
      );
    }

    const fileId = crypto.randomUUID();

    const objectPath =
      `${user.id}/${reference}/${fileId}.${extension}`;

    const { data, error } = await supabase.storage
      .from(config.bucket)
      .createSignedUploadUrl(objectPath);

    if (error || !data) {
      console.error("createSignedUploadUrl failed", error);

      return json(
        {
          code: "signed_upload_failed",
          user_message: "Secure upload could not be prepared.",
        },
        400,
      );
    }

    return json({
      ok: true,
      bucket: config.bucket,
      path: objectPath,
      token: data.token,
      signed_url: data.signedUrl,
      upload_type: uploadType,
      reference,
      mime_type: mimeType,
      max_size: config.maxSize,
    });
  } catch (error) {
    console.error("create-signed-upload error", error);

    return json(
      {
        code: "signed_upload_failed",
        user_message: "Secure upload could not be prepared.",
      },
      400,
    );
  }
});

