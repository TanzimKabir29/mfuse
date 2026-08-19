# MFuse infrastructure

Terraform for hosting MFuse for free: [Neon](https://neon.tech) for Postgres and
[Render](https://render.com) for the frontend (static site) — both Terraform-managed. The backend
also runs on Render, but is **not** Terraform-managed; it's created by hand in Render's dashboard.
See "Why the backend isn't in Terraform" below for why.

The frontend is deployed straight from this GitHub repo — Render clones it and builds it itself on
every push to `main` (`auto_deploy = true`). The backend, once created by hand, does the same thing
on its own — auto-deploy is a property of the Render service, not of Terraform managing it.

## Prerequisites

**Render:**

1. Sign up at [render.com](https://render.com) — no card needed.
2. Connect Render's GitHub App to this repo: dashboard → Account Settings → GitHub.
3. Generate an API key: Account Settings → API Keys.
4. Note your workspace/owner ID (visible in the dashboard URL once you're in a workspace).

**Neon:**

5. Sign up at [neon.tech](https://neon.tech) (free tier, no card).
6. Generate an API key: Account Settings → API Keys.
7. Note your organization ID: Organization settings page.

**Google** — unchanged from local dev; this is about login, not hosting:

8. You already have an OAuth client from local dev. Keep it — you'll add a second redirect URI to
   it once the backend exists (see the next section).

## Setup order

Creating the backend by hand means a few things depend on each other in a specific order:

1. `cp terraform.tfvars.example terraform.tfvars`, fill in `render_api_key`, `render_owner_id`,
   `github_repo_url`, `neon_api_key`, `neon_org_id`. Leave `backend_api_url` blank.
2. `terraform init`, `terraform plan`, `terraform apply`. This creates the Neon database and the
   frontend static site (its `VITE_API_BASE_URL` will be empty for now — that's fixed in step 5).
3. Read `database_connection_uri` from the outputs (`terraform output -raw database_connection_uri`)
   and `frontend_url`.
4. In Render's dashboard, create the web service by hand — New → Web Service, connect this repo,
   runtime **Docker**, root directory `backend`, Dockerfile path `backend/Dockerfile`, plan **Free**,
   auto-deploy **on**. Set its environment variables:
   - `SERVER_PORT` = `10000`
   - `DATABASE_URL` = the connection string from step 3
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` = your existing OAuth client's values
   - `FRONTEND_ORIGIN` = the `frontend_url` from step 3
   - `GOOGLE_REDIRECT_URL` = leave it for now — the service's own URL doesn't exist until it's created
5. Once the service exists, Render assigns it a URL. Set `GOOGLE_REDIRECT_URL` on the service to
   `<that url>/v1/auth/google/callback`, and register that same value as an Authorized redirect URI
   on the OAuth client in Google Cloud Console.
6. Back in `terraform.tfvars`, set `backend_api_url` to that same URL, and `terraform apply` again
   so the frontend rebuilds with the correct API base URL.

## Why the backend isn't in Terraform

It was, originally (`render_web_service` in `main.tf`). Render's Terraform provider has a confirmed,
currently-unresolved bug ([render-oss/terraform-provider-render#80](https://github.com/render-oss/terraform-provider-render/issues/80)):
`maintenance_mode` is an `optional+computed` field that the provider resends on every update
regardless of config, and Render's API rejects any `maintenance_mode` value at all for free-tier
services — so *any* change to a Terraform-managed free web service fails, including unrelated ones
like an env var update. Setting it explicitly (`maintenance_mode = { enabled = false }`) didn't help
either. The bug reporter's attempts at `lifecycle { ignore_changes }` and manual state edits didn't
work either.

This is a narrow Terraform-tooling bug, not a hosting problem — Render's actual free web service
tier works fine, no card, and still auto-deploys on push once it exists. So rather than switching
hosting providers over it, the backend is just created once by hand instead of through Terraform.
Neon and the frontend static site aren't affected by this bug and stay Terraform-managed.

**If a resource is already in Terraform's state and you want to stop managing it, deleting its
block from `main.tf` is not enough on its own.** Terraform's whole model is "make reality match
config" — if state says a resource exists but the config no longer mentions it, the next `apply`
concludes it should be destroyed, and destroys the real thing, even if the block you removed was
unrelated to what you're actually trying to change. The correct order is always: `terraform state rm
<resource>` first (removes it from Terraform's bookkeeping only, touches nothing real), *then*
delete the block from the `.tf` file.

## Other things confirmed the hard way

`terraform validate` confirms the configuration is well-formed against the real provider schemas
(checked by pulling them directly from the installed plugins, not guessed from docs) — it can't
confirm a live apply succeeds without surprises, since some things are only enforced by the actual
API:

- **`neon_project` needs `org_id`.** Neon's API rejects project creation without it, even though the
  provider's schema marks it as merely optional.
- **`history_retention_seconds` defaults too high for the free tier.** The provider defaults to 1
  day (86400 seconds); this account's plan caps it at 21600 (6 hours). Set explicitly in `main.tf`.
- **Render's region list** (`frankfurt`, `ohio`, `oregon`, `singapore`, `virginia`) and **Neon's
  region ID format** are just strings from each provider's docs, not enums Terraform validates.
  Double check `neon_region_id` against Neon's current region list before applying.
- **The static site needs an explicit SPA-fallback rewrite.** Without it, a fresh navigation
  straight to a client-side route like `/s/:id` 404s at the host level, before React Router ever
  loads — confirmed by actually clicking a generated link. `main.tf`'s `routes` block rewrites
  anything that isn't a real file to `/index.html`; Render checks for a real file first, so this
  doesn't interfere with the actual JS/CSS assets loading normally.

## Remote state

State is local by default (a `.tfstate` file in this directory, gitignored) — fine solo. Once more
than one person or machine touches this, create a small S3 (or similar) bucket for state and
uncomment the backend block in `providers.tf`, then `terraform init -migrate-state`.

## Files

The `.tf` files themselves stay terse on purpose — this README is where the explanations live.

- `providers.tf` — provider versions and the (currently local) state backend.
- `variables.tf` — every input. Descriptions are one-liners; see this README for the rest.
- `main.tf` — the Neon project and the Render static site (frontend only — see above).
- `outputs.tf` — `frontend_url` and the (sensitive) database connection string.
- `terraform.tfvars.example` — template for your own `terraform.tfvars`.
