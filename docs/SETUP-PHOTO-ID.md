# Turn on real photo-ID

Stephen — this is the dumb-simple walk-through to get photo-ID running
against your real Anthropic credit. Total time once you start:
**~5 minutes**. No CLI tools, no `npm install`, no Supabase, no
Vercel. Just two browser tabs — Cloudflare and GitHub — plus a
push.

---

## Before you start

- [ ] You have an Anthropic API key (`sk-ant-...`). If you don't,
      log in at console.anthropic.com → "API Keys" → "Create Key".
      Your $10 credit is already there waiting.
- [ ] You can sign in to GitHub for this repo
      (github.com/Stephenuffugus/trackfit).
- [ ] You can sign in to Cloudflare. If you don't have an account,
      sign up at dash.cloudflare.com — it's free, no credit card.

---

## Part 1 — deploy the Worker (3 min)

The Worker is a tiny piece of code that lives on Cloudflare's free
tier. It takes the photo from the app, calls Anthropic, and returns
the guess. Anthropic key never leaves the server.

1. Open **dash.cloudflare.com**.
2. Left sidebar → **Workers & Pages** → **Create**. Pick **"Hello
   World" Worker** as the starting template (we'll replace its code).
3. Name it whatever you like — `trackfit-vision` is a fine default.
   Click **Deploy** to create it.
4. After deploy, click **Edit code** (or Quick Edit). A code editor
   opens.
5. Open this file in your local repo:
   `/infra/cloudflare-worker/src/index.ts`
6. Copy its entire contents. Paste into the Cloudflare editor,
   replacing whatever is there.
7. Click **Save and Deploy**.

The Worker is live. Cloudflare shows you its URL — something like
`https://trackfit-vision.YOURNAME.workers.dev`. Keep that URL handy
for Part 3.

---

## Part 2 — give the Worker your API key (1 min)

1. In the same Cloudflare Worker page, go to **Settings** →
   **Variables and Secrets**.
2. Click **Add variable** → switch the type to **Secret** (the
   encrypted kind — important). Name: `ANTHROPIC_API_KEY`. Value:
   your `sk-ant-...` key.
3. Click **Save and deploy** so the secret takes effect.

Optional — to override the default model from Haiku 4.5 to Sonnet
4.6 or Opus 4.7 (more accurate, more cost per call), add another
variable (plain text, not secret) named `MODEL` with value
`claude-sonnet-4-6` or `claude-opus-4-7`. Skip unless accuracy is a
problem.

---

## Part 3 — wire the GitHub deploy (1 min + push)

The GitHub Pages build needs to know two things: that the proxy is
on (`VITE_USE_REAL_PHOTO_ID=true`) and where it lives
(`VITE_PHOTO_ID_PROXY_URL=https://...`). We pass them in as repo
secrets so the URL stays out of public source.

1. Open **github.com/Stephenuffugus/trackfit**.
2. **Settings** → **Secrets and variables** → **Actions** → **New
   repository secret**.
3. Add **two** secrets:
   - Name: `VITE_USE_REAL_PHOTO_ID`     Value: `true`
   - Name: `VITE_PHOTO_ID_PROXY_URL`    Value: your Cloudflare
     Worker URL from Part 1 (e.g.
     `https://trackfit-vision.YOURNAME.workers.dev`)
4. Trigger a redeploy: either push any commit to `main`, or in the
   Actions tab click **Deploy Trackfit web app to GitHub Pages** →
   **Run workflow** → **Run workflow** on the main branch.

Wait ~2 minutes for the deploy to finish. Refresh
trackfit.stevieweedseed.com on your phone and take a photo of a
piece. You should see "Identifying…" and then either an auto-fill
or the candidate-confirm sheet — backed by the real Vision API.

---

## How to check it's actually working

Open the browser dev tools' Network tab on the page (mobile testing
is easier from a desktop browser via responsive view). Take a photo
in the app. You should see a `POST` to your Cloudflare Worker URL
that returns a JSON `{ candidates: [...] }`.

If the request fails (any reason), the app falls back to the stub
identifier silently — your tester won't see a broken state. Check
your Cloudflare Worker dashboard's **Logs** tab to see what went
wrong; common causes are an expired API key or a typo'd secret name.

---

## How much will it cost

At Haiku 4.5 vision pricing (May 2026: $1/MTok input, $5/MTok
output, plus image tokens), each photo-ID call is roughly
**$0.005–0.012**. Your $10 credit covers **~800–2000 calls**.

Math for sanity:
- One tester session, 30 photos = ~$0.15–0.36
- Ten tester sessions = ~$1.50–3.60
- Your tester walking through the app three times = under $1

If you want a hard ceiling, set a budget alert in the Anthropic
console (Console → Settings → Usage limits). The Worker has no
internal rate limit because the $10 credit IS the rate limit — when
the credit runs out, calls fail and the app falls back to the stub
gracefully.

---

## How to turn it off

Two options, ordered by reversibility:

1. **Pause for a single tester session**: In GitHub repo → Secrets,
   set `VITE_USE_REAL_PHOTO_ID` to anything other than `true` (e.g.
   `false`). Trigger a redeploy. The stub takes over.
2. **Permanent**: In Cloudflare → Workers, delete the Worker. The
   build still ships fine without it; calls fail and fall back.

You can also rotate the Anthropic key from the Anthropic console at
any time — paste the new key into the Cloudflare Worker secret and
redeploy the worker. No code change needed.

---

## What's still on your plate

This setup gets you photo-ID working. It does **not** turn on:

- Real pricing for Trackfit Premium (still "we're still figuring out
  a fair price" until you set `VITE_PREMIUM_LIFETIME_URL` /
  `VITE_PREMIUM_MONTHLY_URL` in repo secrets).
- Cloud sync (still on local-storage only — `supabase/migrations`
  exist but the project isn't deployed; deferred).
- Discord feedback link (still hidden until you set
  `VITE_DISCORD_FEEDBACK_URL` in repo secrets).

Each of those is the same shape as this setup: a couple of
GitHub secrets, no code change. They can wait until after the
first tester session.
