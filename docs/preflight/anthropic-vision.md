# Anthropic Vision Pre-flight (Trackfit, May 2026)

Sources: [models](https://platform.claude.com/docs/en/about-claude/models/overview), [vision](https://platform.claude.com/docs/en/build-with-claude/vision), [pricing](https://platform.claude.com/docs/en/about-claude/pricing), [rate limits](https://platform.claude.com/docs/en/api/rate-limits), [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

## 1. Vision model availability

All current Claude models accept image input.

| Model | API ID | Vision notes |
|---|---|---|
| Opus 4.7 | `claude-opus-4-7` | First Claude with **high-res** support (2576 px long edge, 4784-token cap). Most capable, moderate latency. New tokenizer (~+35% tokens vs prior). |
| Sonnet 4.6 | `claude-sonnet-4-6` | Standard 1568 px / 1568-token cap. Best speed/intelligence balance. |
| Haiku 4.5 | `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5`) | Same 1568 cap. Fastest, near-frontier. |

## 2. Pricing & per-image cost (1200×900 photo)

Token formula: `tokens ≈ width × height / 750`. 1200×900 → 1,920 tokens on Opus 4.7; resized to ~1,568 tokens on Sonnet 4.6 (long edge >1568 px).

| Model | Input $/MTok | Output $/MTok |
|---|---|---|
| Opus 4.7 | $5 | $25 |
| Sonnet 4.6 | $3 | $15 |

Per request = image tokens + 200-token system + 150-token JSON output:

- **Opus 4.7:** (1920 + 200) × $5/1M + 150 × $25/1M = $0.01060 + $0.00375 = **~$0.01435 / image**
- **Sonnet 4.6:** (1568 + 200) × $3/1M + 150 × $15/1M = $0.00530 + $0.00225 = **~$0.00755 / image**

## 3. Limits

- **Max dimensions:** 8000×8000 px (drops to 2000×2000 px if >20 images per request).
- **Max images per API request:** 100 (200k-context models), 600 (1M-context: Opus 4.7, Sonnet 4.6). Request body capped at **32 MB** — use the Files API for many images.
- **Formats:** JPEG, PNG, GIF, WebP (animations: first frame only).
- **Native resize cap:** 2576 px / 4784 tok (Opus 4.7); 1568 px / 1568 tok (others). Larger inputs auto-downsampled, padded to multiples of 28 px.
- **Tier 1 rate limits** (shared across all `Opus 4.x` and all `Sonnet 4.x`): 50 RPM, 30,000 ITPM, 8,000 OTPM. Tier 2: 1,000 RPM / 450,000 ITPM / 90,000 OTPM. Cache reads do not count toward ITPM on 4.x.

## 4. Prompt caching with images

Images are cacheable like text via `cache_control`. **Minimum cacheable prefix on Opus 4.7 / Sonnet 4.6 / Haiku 4.5 is 4,096 tokens** (text + images combined); below that, caching silently no-ops. A single 1200×900 photo (~1.5–1.9k tokens) won't cache alone — pair with a sufficiently large cached system prompt or tool schema. Cache read = 10% of base input; 5-min write 1.25×, 1-hour write 2×.

## 5. Server-side proxy pattern

1. Browser uploads image to your backend (HTTPS, multipart). **Never expose the API key client-side.**
2. Backend authenticates user, validates MIME, strips EXIF, and **pre-resizes** to ≤1568 px (or ≤2576 px for Opus 4.7) to control tokens and latency.
3. Backend calls `POST /v1/messages` with `x-api-key`. Image is sent inline as a base64 `image` block, or by `file_id` after a one-time Files API upload (preferred for repeat use / batches).
4. Backend returns parsed JSON to the client. Cache the (large) system prompt + tool schemas across requests; per-photo image content typically stays uncached.

Hardening: per-user rate limiting, request size cap (<32 MB), MIME allow-list, signed URLs for stored originals.

## Cost projection (1200×900, 200-token system, 150-token JSON)

| Volume | Opus 4.7 (~$0.01435/img) | Sonnet 4.6 (~$0.00755/img) |
|---:|---:|---:|
| 100 | **$1.44** | **$0.76** |
| 1,000 | **$14.35** | **$7.55** |
| 10,000 | **$143.50** | **$75.55** |
| 100,000 | **$1,435** | **$755** |

(Batch API halves these: Opus 4.7 $2.50/$12.50, Sonnet 4.6 $1.50/$7.50 per MTok in/out.)

**Recommendation:** Default to **`claude-sonnet-4-6`** — ~47% cheaper per image, same effective image-token cap at 1200×900, equivalent Tier-1 limits; reserve `claude-opus-4-7` for cases where its 2576 px high-res mode actually pays off (small text, fine detail).
