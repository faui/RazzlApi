# GitHub — Razzl API (`api.razzl.com`)

**GitHub:** https://github.com/faui/RazzlApi.git  
**Role:** Commerce Integration Core, Shopify adapter, external APIs, webhooks, storefront CTA resolver

## Start here

1. Read commerce docs in **Studio repo**: `../studio/docs/commerce/README.md`
2. Read [`../studio/docs/commerce/API-REPO.md`](../studio/docs/commerce/API-REPO.md) (architecture, terraform, CI/CD)
3. Read [`../studio/docs/commerce/STUDIO-CONTRACT.md`](../studio/docs/commerce/STUDIO-CONTRACT.md) before Studio integration
4. Check `CONTINUE-HERE.md` in this repo (and Studio repo for schema slices)

## Key rules

- **Do not rebuild Studio** (dashboard, profile, Stripe billing, copilot editor) in this repo
- **Schema migrations live in Studio repo** — `../studio/db/migrations/`
- **Generic `commerce_*` naming** in core; `shopify` only in adapter layer
- **Never hardcode secrets** — use Secrets Manager / `.env.local`
- Update `CONTINUE-HERE.md` at end of every session

## Local setup

```powershell
cd C:\venkat\razl\ai_dev\alaunch2026\api
copy .env.example .env.local
npm install
npm run dev
```

Health: `GET http://localhost:8080/health`

Open **`alaunch2026.code-workspace`** (studio + api + chat) in Cursor for cross-repo Composer work.

## Related repos

| Repo | Path |
|------|------|
| Studio (schema, docs, UI) | `../studio` |
| Chat | `../chat` |

## Status

Slice 1 complete — commerce types + DB skeleton. CI/CD: see [`.github/DEPLOYMENT.md`](.github/DEPLOYMENT.md) for GitHub Environment setup.
