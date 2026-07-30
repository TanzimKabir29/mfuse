# MFuse infrastructure

Terraform for hosting MFuse for free: [Render](https://render.com) for both the backend (from the
existing Dockerfile) and the frontend (static site), [Neon](https://neon.tech) for Postgres. None of
these require a credit card to sign up.

Backend and frontend are both deployed straight from this GitHub repo — Render clones it and builds
it itself on every push to `main` (`auto_deploy = true`), so there's no separate "build and push an
image" CI step needed the way a container-registry-based host would require.

## Prerequisites

**Render:**

1. Sign up at [render.com](https://render.com) — no card needed.
2. Connect Render's GitHub App to this repo: dashboard → Account Settings → GitHub. Render can't
   clone a private repo without this, and Terraform can't do this step for you.
3. Generate an API key: Account Settings → API Keys.
4. Note your workspace/owner ID (visible in the dashboard URL once you're in a workspace).

**Neon:**

5. Sign up at [neon.tech](https://neon.tech) (free tier, no card).
6. Generate an API key: Account Settings → API Keys.

**Google** — unchanged from local dev; this is about login, not hosting, so it doesn't move:

7. You already have an OAuth client from local dev setup. Keep it — see the bootstrap section below
   for updating its redirect URI.

## Usage

```
cp terraform.tfvars.example terraform.tfvars   # fill in real values
terraform init
terraform plan
terraform apply
```

`terraform.tfvars` is gitignored — it holds live credentials, never commit it.

### Bootstrapping the three URL-dependent variables

Three variables can't be known before the first apply, because they all depend on URLs that Render
only assigns once the services actually exist: `google_redirect_url`, `frontend_origin`, and
`backend_api_url`. Each has a bootstrap explanation on the variable itself in `variables.tf`. The
short version:

1. Leave all three blank and `terraform apply`.
2. Read `backend_url` and `frontend_url` from the outputs.
3. Register `<backend_url>/v1/auth/google/callback` as an Authorized redirect URI on the OAuth
   client in Google Cloud Console (same place as local dev).
4. Fill in all three variables to match those actual URLs, and `terraform apply` again.

### What Terraform manages vs. what happens automatically

This provisions the **standing infrastructure** — the two Render services and the Neon database
existing, with the right environment variables wired between them. It's run rarely, by hand, only
when that infrastructure itself changes shape (a new env var, a plan change).

Actually *shipping new code* isn't a Terraform concern here the way it would be on a
registry-based host like Cloud Run — Render watches `main` itself (`auto_deploy = true` on both
services) and rebuilds/redeploys automatically on every push. CI's job on merge to main becomes
just confirming the tests already passed on the PR — Render does the deploy itself, not a CI step.

### Remote state

State is local by default (a `.tfstate` file in this directory, gitignored) — fine solo. Once more
than one person or machine touches this, create a small S3 (or similar) bucket for state and
uncomment the backend block in `providers.tf`, then `terraform init -migrate-state`.

## Files

- `providers.tf` — provider versions and the (currently local) state backend.
- `variables.tf` — every input, with descriptions, including the bootstrap variables' ordering.
- `main.tf` — the Neon project, the Render web service (backend, Docker runtime from
  `backend/Dockerfile`), and the Render static site (frontend, built from `frontend/`).
- `outputs.tf` — `backend_url`, `frontend_url`, and the (sensitive) database connection string.
- `terraform.tfvars.example` — template for your own `terraform.tfvars`.

## Things worth double-checking before your first real apply

This has been checked with `terraform validate` against the real, installed provider schemas (real
resource types and attribute names — confirmed by pulling the schema directly from the provider
plugin, not just guessed from docs) and `terraform fmt`. Two things that validate can't confirm,
since they need a live API call with real credentials to check:

- **`plan = "free"` on the web service.** Render's Terraform provider schema documents `starter`,
  `standard`, `pro`, `pro_plus`, `pro_max`, and `pro_ultra` as valid values for `plan` — notably,
  `free` isn't listed, even though Render's own free web service tier definitely still exists
  (confirmed separately, and confirmed not to need a card). This could mean the free tier just
  isn't in the schema's example documentation, or it could mean the API only creates free-tier
  services through Render's dashboard, not through the API/Terraform. Your first `terraform apply`
  will tell you for certain. If it's rejected, the fallback is: create the free web service by hand
  in Render's dashboard once, then `terraform import` it (the provider supports this — see
  `examples/resources/render_web_service/import.sh` in their repo) so Terraform manages it from
  then on without needing to have created it.
- **Render's region list** (`frankfurt`, `ohio`, `oregon`, `singapore`, `virginia`) and **Neon's
  region ID format** — both are just strings from each provider's docs, not enums Terraform itself
  validates. Double check `neon_region_id` in particular against Neon's current region list before
  applying.
