# Trackfit photo-ID Cloudflare Worker

Single-file Cloudflare Worker that proxies the web client's photo-ID
requests to the Anthropic Messages API. Free tier covers tester
sessions ~3 orders of magnitude over.

For the deploy walk-through, see
[`/docs/SETUP-PHOTO-ID.md`](../../docs/SETUP-PHOTO-ID.md).

## Local sanity

This worker is plain TypeScript; the Trackfit repo's TS compiler will
typecheck it as part of `pnpm -r typecheck` once we add it to a
project. To unit-test in isolation:

```sh
# Optional, only if you want CLI deploys instead of the dashboard:
npm i -g wrangler
wrangler login
wrangler deploy
wrangler secret put ANTHROPIC_API_KEY
```

The dashboard path in `SETUP-PHOTO-ID.md` is supported and does not
require the CLI.
