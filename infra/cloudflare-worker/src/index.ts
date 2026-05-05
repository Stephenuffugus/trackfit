/**
 * Trackfit photo-ID proxy — Cloudflare Worker.
 *
 * Single-file, zero-dependency Cloudflare Worker that proxies the web
 * client's photo-ID requests to the Anthropic Messages API. Lives here
 * (and not in `apps/web/api/`) because Trackfit's web app deploys to
 * GitHub Pages — static-only, no serverless functions. The Worker is a
 * separate compute platform on Cloudflare's free tier (100k requests
 * per day, single-file deploy).
 *
 * Why Cloudflare Workers and not Supabase / Vercel / Netlify:
 *  - free tier covers tester-session traffic ~3 orders of magnitude over
 *  - one-page setup at dash.cloudflare.com (paste this code, set secret,
 *    save) — no CLI, no account-juggling
 *  - tiny cold start
 *  - built-in fetch + crypto, no `npm install`
 *
 * Setup (see /docs/SETUP-PHOTO-ID.md for the full walk-through):
 *   1. Create a Worker at dash.cloudflare.com → Workers
 *   2. Paste this file's contents into the editor
 *   3. Settings → Variables → add `ANTHROPIC_API_KEY` as an encrypted
 *      secret (sk-ant-...)
 *   4. Save and deploy
 *   5. Copy the worker URL (e.g. trackfit-vision.you.workers.dev)
 *   6. Set GitHub repo Actions secrets:
 *        - VITE_PHOTO_ID_PROXY_URL = https://trackfit-vision.you.workers.dev
 *        - VITE_USE_REAL_PHOTO_ID  = "true"
 *   7. Push to main; GH Pages rebuilds with the proxy URL baked in.
 *
 * Cost expectation: at Claude Haiku 4.5 vision pricing (~$1/MTok in,
 * $5/MTok out, plus image tokens ~$0.005/photo at typical 1200px JPEG
 * sizes), each call is ~$0.005-0.012. A $10 budget = 800-2000 calls,
 * which is plenty for tester sessions. Override `MODEL` env var to
 * `claude-sonnet-4-6` or `claude-opus-4-7` for higher accuracy at
 * higher per-call cost.
 *
 * Failure mode: when the upstream call fails for ANY reason, the worker
 * returns a graceful error response. The web client falls back to the
 * stub identifier so users never see a broken state. Per handoff §3,
 * never block the user.
 */

interface Env {
  /** Anthropic API key, set as an encrypted Worker secret. */
  ANTHROPIC_API_KEY?: string;
  /** Override the default model. Default is Haiku 4.5 for cost. */
  MODEL?: string;
  /** Comma-separated list of allowed origins for CORS. Defaults to
   *  the production custom domain. Add localhost for dev. */
  ALLOWED_ORIGINS?: string;
  /** Cap on encoded image bytes per request. Default 2 MB. */
  MAX_IMAGE_BYTES?: string;
}

interface IdentifyRequestBody {
  /** Data URL OR raw base64. */
  photo_base64?: string;
  /** Trackfit library system id, e.g. "lionel-fastrack". */
  active_preset_id?: string | null;
}

interface IdentifyCandidate {
  label: string;
  confidence: number;
  length_mm: number;
  kind: "straight" | "curve" | "turnout" | "crossing" | "fitter" | "flex";
  radius_mm?: number;
  arc_degrees?: number;
  product_code?: string;
  system_label?: string;
}

interface IdentifyResponse {
  candidates: IdentifyCandidate[];
  /** Echoed so the client can show usage hints if it wants. Unused
   *  today but stable. */
  cost_usd_estimate?: number;
  model?: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://trackfit.stevieweedseed.com",
  "https://stephenuffugus.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("origin") ?? "";
    const allowed = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allowList = allowed.length > 0 ? allowed : DEFAULT_ALLOWED_ORIGINS;
    const corsOrigin = allowList.includes(origin) ? origin : allowList[0]!;
    const corsHeaders: Record<string, string> = {
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
      vary: "origin",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse(
        { error: "method_not_allowed", message: "POST only." },
        405,
        corsHeaders,
      );
    }

    if (!env.ANTHROPIC_API_KEY) {
      // Without a key, the worker is "online but unfunded." Return a
      // structured error the client can fall back from cleanly. Per
      // handoff §3, photo-ID is augmentation; the manual entry path
      // stays available.
      return jsonResponse(
        {
          error: "vision_disabled",
          message:
            "Photo identification is currently disabled. Tap the row's text fields to enter the piece manually.",
        },
        503,
        corsHeaders,
      );
    }

    let body: IdentifyRequestBody;
    try {
      body = (await req.json()) as IdentifyRequestBody;
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400, corsHeaders);
    }

    if (!body.photo_base64 || typeof body.photo_base64 !== "string") {
      return jsonResponse(
        { error: "missing_photo_base64" },
        400,
        corsHeaders,
      );
    }

    const maxBytes = Number(env.MAX_IMAGE_BYTES) || DEFAULT_MAX_IMAGE_BYTES;
    if (body.photo_base64.length > maxBytes) {
      return jsonResponse(
        {
          error: "image_too_large",
          message:
            "The image is larger than the proxy accepts. Re-take the photo at a smaller resolution.",
        },
        413,
        corsHeaders,
      );
    }

    const stripped = body.photo_base64.replace(
      /^data:image\/(jpeg|png|webp);base64,/i,
      "",
    );
    const mediaType = inferMediaType(body.photo_base64);

    const model = env.MODEL || DEFAULT_MODEL;
    const systemPrompt = buildSystemPrompt(body.active_preset_id ?? null);

    let anthropicResponse: Response;
    try {
      anthropicResponse = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 600,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType,
                      data: stripped,
                    },
                  },
                  {
                    type: "text",
                    text: "Identify the model railroad track piece in this photo. Return JSON only.",
                  },
                ],
              },
            ],
          }),
        },
      );
    } catch (err) {
      return jsonResponse(
        {
          error: "upstream_unreachable",
          message: "Couldn't reach the identification service. Try again or enter the piece manually.",
          detail: err instanceof Error ? err.message : String(err),
        },
        502,
        corsHeaders,
      );
    }

    if (!anthropicResponse.ok) {
      const errText = await safeReadText(anthropicResponse);
      return jsonResponse(
        {
          error: "anthropic_error",
          status: anthropicResponse.status,
          detail: errText.slice(0, 500),
        },
        502,
        corsHeaders,
      );
    }

    const ant = (await anthropicResponse.json()) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = ant?.content?.[0]?.text ?? "";
    const parsed = safeParseJson(text);

    if (!parsed || !Array.isArray((parsed as { candidates?: unknown }).candidates)) {
      return jsonResponse(
        {
          error: "unparseable_model_output",
          message:
            "The identifier returned a non-JSON response. Try again or enter the piece manually.",
          raw: text.slice(0, 500),
        },
        502,
        corsHeaders,
      );
    }

    const rawCandidates = (parsed as { candidates: unknown[] }).candidates;
    const sanitized = rawCandidates
      .slice(0, 3)
      .map(sanitizeCandidate)
      .filter((c): c is IdentifyCandidate => c !== null);

    // Pricing reference (May 2026): Haiku 4.5 input $1/MTok, output $5/MTok.
    // Image tokens roughly 1500-2000 at 1200px JPEG; system + user text ~700;
    // output ~200 → ~$0.0030. The estimate is best-effort, only used by the
    // client for usage hints.
    const inputTokens = ant?.usage?.input_tokens ?? 2500;
    const outputTokens = ant?.usage?.output_tokens ?? 200;
    const isHaiku = model.includes("haiku");
    const isOpus = model.includes("opus");
    const inRate = isHaiku ? 1 : isOpus ? 15 : 3;
    const outRate = isHaiku ? 5 : isOpus ? 75 : 15;
    const cost =
      (inputTokens / 1_000_000) * inRate +
      (outputTokens / 1_000_000) * outRate;

    const response: IdentifyResponse = {
      candidates: sanitized,
      cost_usd_estimate: Number(cost.toFixed(5)),
      model,
    };

    return jsonResponse(response, 200, corsHeaders);
  },
};

/* ------------------------------------------------------------------ */

function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function inferMediaType(image: string): "image/jpeg" | "image/png" | "image/webp" {
  const m = /^data:image\/(jpeg|png|webp);base64,/i.exec(image);
  if (m && m[1]) {
    const sub = m[1].toLowerCase();
    if (sub === "png") return "image/png";
    if (sub === "webp") return "image/webp";
  }
  return "image/jpeg";
}

function safeParseJson(text: string): unknown {
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

function sanitizeCandidate(raw: unknown): IdentifyCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  const label = typeof c.label === "string" ? c.label.trim() : "";
  const kind = typeof c.kind === "string" ? c.kind.trim() : "";
  const length_mm = Number(c.length_mm);
  const confidence = Number(c.confidence);

  if (label.length === 0) return null;
  if (
    kind !== "straight" &&
    kind !== "curve" &&
    kind !== "turnout" &&
    kind !== "crossing" &&
    kind !== "fitter" &&
    kind !== "flex"
  ) {
    return null;
  }
  if (!Number.isFinite(length_mm) || length_mm <= 0 || length_mm > 5000) {
    return null;
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return null;
  }

  const out: IdentifyCandidate = {
    label,
    kind: kind as IdentifyCandidate["kind"],
    length_mm,
    confidence,
  };
  if (typeof c.product_code === "string" && c.product_code.length > 0) {
    out.product_code = c.product_code;
  }
  if (typeof c.system_label === "string" && c.system_label.length > 0) {
    out.system_label = c.system_label;
  }
  if (
    typeof c.radius_mm === "number" &&
    Number.isFinite(c.radius_mm) &&
    c.radius_mm > 0
  ) {
    out.radius_mm = c.radius_mm;
  }
  if (
    typeof c.arc_degrees === "number" &&
    Number.isFinite(c.arc_degrees) &&
    c.arc_degrees > 0 &&
    c.arc_degrees <= 360
  ) {
    out.arc_degrees = c.arc_degrees;
  }
  return out;
}

function buildSystemPrompt(activePresetId: string | null): string {
  // The Worker can't import @trackfit/library directly (separate runtime,
  // separate bundle). Instead we describe the supported systems in plain
  // English and let the model emit canonical-looking labels. The client
  // doesn't enforce a strict catalog match — it just asks for plausible
  // candidates. Real-catalog grounding is a future improvement (ship the
  // pieces JSON inline; ~30 KB once gzipped, totally fine).
  const presetHint = activePresetId
    ? `\nThe user currently has the "${activePresetId}" preset loaded. ` +
      "Bias your candidates toward that system unless the photo clearly shows " +
      "a different brand."
    : "";
  return [
    "You identify model railroad sectional track pieces from photos for the Trackfit app.",
    "",
    "Return strict JSON only, no prose, no markdown fences. Schema:",
    "{",
    '  "candidates": [',
    "    {",
    '      "label": "human-readable piece name, e.g. \\"9-inch straight\\"",',
    '      "kind": "straight" | "curve" | "turnout" | "crossing" | "fitter" | "flex",',
    '      "length_mm": <positive number>,',
    '      "radius_mm": <positive number, curves only>,',
    '      "arc_degrees": <positive 0-360, curves only>,',
    '      "product_code": "manufacturer SKU if known, otherwise omit",',
    '      "system_label": "Atlas HO Code 83" | "Lionel FasTrack" | etc.,',
    '      "confidence": 0.0-1.0',
    "    }",
    "  ]",
    "}",
    "",
    "Return up to 3 candidates ordered by confidence. If you are not " +
      "confident enough to suggest any candidate above 0.4, return an empty " +
      "candidates array.",
    "",
    "Geometric features to look for:",
    "- Rail spacing (gauge): N (9 mm), HO (16.5 mm), O (1.25 in with center 3rd rail).",
    "- Integrated roadbed: present in Lionel FasTrack, Bachmann EZ-Track, " +
      "Kato Unitrack, Märklin C-Track. Absent in Atlas Code 83/100, Peco " +
      "Streamline, Märklin K-Track.",
    "- Roadbed colour: brown (Lionel/Atlas), black (Märklin C), grey (Kato), " +
      "dark grey (Bachmann nickel-silver), terracotta (Hornby).",
    "- Tie spacing & rail joiners — distinctive between Atlas (rivetless wide " +
      "ties) and Peco (closer ties).",
    "- Manufacturer markings on packaging or piece if visible.",
    "",
    "Common straight lengths: Atlas 9 in (228.6 mm), 6 in (152.4 mm), 1.5 in fitter; " +
      "Lionel FasTrack 10 in (254 mm), 5 in, 1.375 in fitter; Kato Unitrack 248 mm, " +
      "186 mm, 124 mm, 62 mm; Märklin C-Track 188.3 mm, 94.2 mm, 70.8 mm.",
    "Common curve radii (HO): Atlas 18 in (457 mm), 22 in (559 mm); Bachmann " +
      "18 in / 22 in. (N): Kato R481 / R381 / R315 / R249.",
    "",
    presetHint,
    "",
    "Never invent a product_code that doesn't match a real catalog SKU. If unsure, omit the field.",
  ]
    .filter(Boolean)
    .join("\n");
}
