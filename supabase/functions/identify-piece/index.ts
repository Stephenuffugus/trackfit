/**
 * Trackfit photo-ID server proxy.
 *
 * Deployed as a Supabase Edge Function (Deno runtime) so the Anthropic API key
 * never leaves the server. The web client POSTs a base64 image; we ground
 * Claude with the verified library catalog and return a structured guess.
 *
 * Deploy:  supabase functions deploy identify-piece --no-verify-jwt
 * Set key: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * NOTE (May 2026): the live proxy is gated on a cost discussion that hasn't
 * happened yet. While ANTHROPIC_API_KEY is unset, the function returns 503
 * with a clear message — the web client can detect this and stay on manual
 * entry. Flip to a real key when ready; no code change needed.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

// Per docs/preflight/anthropic-vision.md, sonnet-4-6 is the default for
// per-image cost reasons. Override with claude-opus-4-7 for tougher pieces
// when accuracy matters more than per-call cost.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IdentifyRequest {
  /** data URL OR raw base64 (with no data: prefix) */
  image: string;
  /** optional: limit results to a specific track scale (e.g. "HO") */
  scale_hint?: string;
  /** optional: limit to systems the user has loaded */
  system_hint?: string[];
}

interface IdentifyResponse {
  candidates: Array<{
    system_id: string;
    piece_id: string;
    label: string;
    length_mm: number | null;
    product_code: string | null;
    confidence: number;
    rationale: string;
  }>;
  model: string;
  cost_usd_estimate: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return json(
      {
        error: "vision_disabled",
        message:
          "Photo identification is currently disabled. The app is fully usable; " +
          "tap the row's text fields to enter the piece manually.",
      },
      503,
    );
  }

  let body: IdentifyRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!body.image || typeof body.image !== "string") {
    return json({ error: "missing_image" }, 400);
  }

  // Strip data URL prefix if present.
  const base64 = body.image.replace(/^data:image\/(jpeg|png|webp);base64,/, "");
  const mediaType = inferMediaType(body.image);

  const systemPrompt = buildSystemPrompt(body.scale_hint, body.system_hint);

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "Identify the model railroad track piece in this photo. Return JSON only.",
            },
          ],
        },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    return json(
      { error: "anthropic_error", status: anthropicResponse.status, detail: errText },
      502,
    );
  }

  const ant = await anthropicResponse.json();
  const text = ant?.content?.[0]?.text ?? "";
  const parsed = safeParseJson(text);

  if (!parsed || !Array.isArray(parsed.candidates)) {
    return json(
      {
        error: "unparseable_model_output",
        raw: text,
        message: "Claude returned a non-JSON response; please retry.",
      },
      502,
    );
  }

  // Estimate per-call cost so the client can show usage hints.
  // sonnet-4-6 input: $3/MTok, output: $15/MTok (per docs/preflight/anthropic-vision.md)
  // image at 1200x900 ~ 1920 image tokens; system + user text ~ 800; output ~ 200 → ~$0.011
  const inputTokens = (ant?.usage?.input_tokens as number | undefined) ?? 2700;
  const outputTokens = (ant?.usage?.output_tokens as number | undefined) ?? 200;
  const cost =
    (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;

  const response: IdentifyResponse = {
    candidates: parsed.candidates.slice(0, 3),
    model: ANTHROPIC_MODEL,
    cost_usd_estimate: Number(cost.toFixed(5)),
  };

  return json(response, 200);
});

// ---------------------------------------------------------------------------

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function inferMediaType(image: string): "image/jpeg" | "image/png" | "image/webp" {
  const m = /^data:(image\/(jpeg|png|webp));base64,/.exec(image);
  if (m && m[1]) return m[1] as "image/jpeg" | "image/png" | "image/webp";
  return "image/jpeg";
}

function safeParseJson(text: string): { candidates?: unknown[] } | null {
  // The model may wrap JSON in ```json ... ``` fences.
  const stripped = text
    .replace(/^[\s\S]*?```(?:json)?\s*/i, "")
    .replace(/```[\s\S]*$/, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function buildSystemPrompt(scale?: string, systems?: string[]): string {
  return [
    "You identify model railroad sectional track pieces from photos for the Trackfit app.",
    "",
    "Return strict JSON only, no prose, no markdown fences. Schema:",
    "{",
    '  "candidates": [',
    "    {",
    '      "system_id": "lionel-fastrack" | "atlas-ho-code-83" | ...,',
    '      "piece_id": "10in-straight" | "o36-curve" | ...,',
    '      "label": "human readable piece name",',
    '      "length_mm": number | null,',
    '      "product_code": "manufacturer SKU or null",',
    '      "confidence": 0.0-1.0,',
    '      "rationale": "one short sentence on what features informed the guess"',
    "    }",
    "  ]",
    "}",
    "",
    "Return up to 3 candidates ordered by confidence. If you are not confident enough to suggest any candidate above 0.4, return an empty candidates array.",
    "",
    "Geometric features to look for:",
    "- Rail spacing (gauge): N (9mm), HO (16.5mm), O27 (1¼\"), O (1¼\" with center 3rd rail).",
    "- Integrated roadbed: present in Lionel FasTrack, Bachmann EZ-Track, Kato Unitrack, Märklin C-Track. Absent in Atlas Code 83/100 sectional, Peco Streamline, Märklin K-Track.",
    "- Roadbed color: brown (Lionel/Atlas), black (Märklin C), grey (Kato), dark grey (Bachmann nickel-silver), terracotta (Hornby).",
    "- Tie spacing & rail joiners — distinctive between Atlas (rivetless wide ties) and Peco (closer ties).",
    "- Manufacturer markings on packaging or piece if visible.",
    "",
    scale ? `User hint: scale is "${scale}".` : "",
    systems && systems.length > 0
      ? `User hint: limit candidates to these systems if plausible: ${systems.join(", ")}.`
      : "",
    "",
    "Never invent a piece_id or product_code that doesn't match a real catalog SKU. If unsure of the SKU, set product_code to null.",
  ]
    .filter(Boolean)
    .join("\n");
}
