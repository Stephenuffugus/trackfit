# Supabase Pre-flight Research (Trackfit)

> **Note on sources:** Both `WebFetch` and `WebSearch` were denied at runtime in this environment despite being nominally allowed for `supabase.com`. Findings below reflect Supabase's published limits as of the assistant's knowledge cutoff (Jan 2026); URLs are cited for the user to verify before launch. Re-verify against `https://supabase.com/pricing` immediately before go-live.

## 1. Free-tier limits (as of early 2026)

Source: `https://supabase.com/pricing`

| Resource | Free limit |
|---|---|
| Database size | **500 MB** per project |
| Storage | **1 GB** total |
| Egress / bandwidth | **5 GB / month** (combined DB + Storage + Realtime + Auth) |
| MAU (Auth) | **50,000** monthly active users |
| Projects | **2 active** organisations/projects per free org |
| Inactivity pause | Project **paused after 7 days** of no API activity; one-click restore from dashboard |
| File upload size | 50 MB per file |
| Edge Function invocations | 500K / month |

## 2. Pro tier

Source: `https://supabase.com/pricing`

- **$25 / project / month** base.
- No inactivity pause; daily backups (7-day retention); 8 GB DB included (then $0.125/GB), 100 GB storage, 250 GB egress, 100K MAU included, custom SMTP rate uplift, point-in-time recovery as add-on, log retention 7 days.
- Compute add-ons priced separately (micro included).

## 3. Auth — magic-link email

Source: `https://supabase.com/docs/guides/auth/auth-email-passwordless`, `https://supabase.com/docs/guides/auth/auth-smtp`

- Magic-link / OTP email **available on free tier**.
- **Default (Supabase-provided SMTP) is rate-limited to ~2 emails/hour per project** and intended for development only. Hitting this limit causes silent sign-in failures.
- For production: configure **custom SMTP** (Resend, Postmark, SES, SendGrid) via Dashboard → Auth → SMTP Settings. Then auth email rate limit raises to ~30/hour by default and is configurable.
- Other limits: token verification 30/5 min per IP; sign-ups 30/5 min per IP (configurable on Pro).

## 4. Storage — signed URLs for private images

Source: `https://supabase.com/docs/guides/storage/serving/private-buckets`

- Create bucket as **private**, then generate signed URLs via `createSignedUrl(path, expiresInSeconds)`.
- Expiry is arbitrary (seconds to years); URL contains a JWT.
- Served via global CDN; ~150 KB JPEGs are well-suited (cached at edge after first hit).
- Batch endpoint `createSignedUrls()` supports many paths in one call — useful for grids/galleries.
- Image transformation (resize/quality) available on Pro+ via `?width=…&quality=…`.

## 5. Schema migrations — CLI vs Dashboard

Source: `https://supabase.com/docs/guides/deployment/database-migrations`, `https://supabase.com/docs/guides/cli/local-development`

- **Recommended: CLI + git.** `supabase init`, `supabase migration new <name>`, edit SQL, `supabase db push` (to remote) or `supabase db reset` (local). Migrations live in `supabase/migrations/*.sql` — version-controlled, reproducible, reviewable in PRs.
- **Dashboard SQL editor** is fine for prototyping but changes are not captured as migrations — you must `supabase db diff` to backfill, or you drift.
- Best practice: dashboard for exploration in dev branch only; all prod schema changes go through CLI + PR.

## 6. EU / data residency

Source: `https://supabase.com/docs/guides/platform/regions`, `https://supabase.com/security`

- Region is chosen **at project creation and is immutable** (move = new project + dump/restore).
- EU regions available on free + paid: **eu-west-1 (Ireland), eu-west-2 (London), eu-central-1 (Frankfurt), eu-central-2 (Zurich), eu-north-1 (Stockholm)**.
- Supabase is **SOC 2 Type II** and **GDPR**-compliant; DPA available. HIPAA on Team/Enterprise only.

---

## Verdict for first 100 beta users (50 pieces, 30 photos avg 150 KB)

Per-user storage: 30 × 150 KB ≈ **4.5 MB**. 100 users ≈ **450 MB**. DB rows (50 pieces + metadata) trivially under 500 MB. MAU 100 ≪ 50K. Egress: assuming each user views their own + browses ~10× the photos they own per month → ~150 MB/user → **~15 GB/month total**, which **exceeds the 5 GB free egress cap**.

**(a) Fits in free tier?** **N** — storage and DB fit comfortably, but projected egress (~15 GB/mo) blows the 5 GB cap once browsing is real. Auth default SMTP also blocks production magic-links.

**(b) Recommendation:** Build on free tier in an **EU region (Frankfurt)** with **custom SMTP (Resend) from day one**; budget to flip to **Pro ($25/mo)** before opening beta to >~30 active users to cover egress and unlock daily backups.
