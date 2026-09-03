// Supabase Edge Function for QZ Tray Signing (Deno runtime)
// Deploy with: supabase functions deploy qz-sign
// Set secret: supabase secrets set QZ_PRIVATE_KEY="$(cat private-key.pem)" QZ_ALLOWED_ORIGINS="https://your-domain.com"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function normalizePem(pem?: string): string {
  if (!pem) return "";
  let cleaned = pem.trim();
  if (cleaned.includes("\\n")) {
    cleaned = cleaned.replace(/\\n/g, "\n");
  }
  return cleaned;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = (Deno.env.get("QZ_ALLOWED_ORIGINS") || "*").split(",").map(s => s.trim());
  const isAllowed = allowedOrigins.includes("*") || allowedOrigins.includes(origin);

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  if (!isAllowed) {
    return new Response(JSON.stringify({ error: "Unauthorized origin" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }

  try {
    const body = await req.json();
    const toSign = typeof body === "string" ? body : body?.request;

    if (!toSign || typeof toSign !== "string") {
      return new Response(JSON.stringify({ error: "Missing data to sign" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const privateKeyPem = normalizePem(Deno.env.get("QZ_PRIVATE_KEY"));
    if (!privateKeyPem) {
      return new Response(
        JSON.stringify({ error: "QZ_PRIVATE_KEY secret is not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    // Convert PEM to CryptoKey for Web Crypto API
    const binaryDerString = atob(
      privateKeyPem
        .replace(/-----BEGIN [A-Z ]+-----/, "")
        .replace(/-----END [A-Z ]+-----/, "")
        .replace(/[\r\n\s]/g, "")
    );
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
      false,
      ["sign"]
    );

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(toSign);
    const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, dataBuffer);

    // Convert signature to Base64
    const signatureBase64 = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer))
    );

    return new Response(
      JSON.stringify({ signature: signatureBase64, algorithm: "SHA512" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Failed to sign request securely" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
