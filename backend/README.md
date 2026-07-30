# MFuse backend

Rust/Axum API for MFuse — see the [root README](../README.md) for what the product actually does,
and [`frontend/README.md`](../frontend/README.md) for the UI this talks to. It stores only opaque,
client-encrypted ciphertext; it never sees a plaintext secret or an encryption key.

## Prerequisites

- Rust — pinned via `rust-toolchain.toml` (currently 1.96.0), so `rustup` will fetch the right
  version automatically
- Docker, for the local Postgres instance
- [`sqlx-cli`](https://github.com/launchbadge/sqlx/tree/main/sqlx-cli), for running migrations:
  ```
  cargo install sqlx-cli --no-default-features --features postgres,rustls
  ```

## Setup

1. Copy the env template and fill it in:
   ```
   cp .env.example .env
   ```
2. Start Postgres:
   ```
   docker compose up -d
   ```
3. Create a Google OAuth client (needed for `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`):
   - In [Google Cloud Console](https://console.cloud.google.com/), create a project (or use an existing one).
   - Under **APIs & Services → OAuth consent screen**, set it up (choose **External** unless you're
     inside a Google Workspace org and want to restrict to it). Add scopes `openid`, `email`,
     `profile`. If your app stays in **Testing** status, add your own Google account under
     **Test users** — otherwise you'll hit an "Access blocked" error the moment you try to log in.
   - Under **APIs & Services → Credentials → Create Credentials → OAuth client ID**, choose
     **Web application**, and add an **Authorized redirect URI** matching `GOOGLE_REDIRECT_URL` in
     your `.env` exactly (e.g. `http://localhost:9001/v1/auth/google/callback`).
   - Copy the resulting Client ID and Client Secret into `.env`.
4. Apply migrations:
   ```
   sqlx migrate run
   ```
5. Run it:
   ```
   cargo run
   ```
   `/health` should respond on whatever port `SERVER_PORT` is set to.

## Commands

| Command | What it does |
|---|---|
| `cargo run` | Start the server |
| `cargo build` | Compile |
| `cargo test` | Run the test suite (see **Testing** below) |
| `cargo fmt` | Format code |
| `cargo fmt --check` | Check formatting without writing changes (CI-style) |
| `cargo clippy` | Lint |

Run `cargo fmt` and `cargo clippy` before submitting a change — see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Testing

```
set -a; source .env; set +a
cargo test
```

**The `source .env` step is required, not optional.** `#[sqlx::test]` (used throughout the test
suite) does not load `.env` itself — unlike the compile-time `sqlx::query!` macros, which have
their own built-in `.env` loading. Skipping this step gives a `DATABASE_URL`/`SERVER_PORT` panic
that has nothing to do with your actual code.

A related gotcha if you ever add a new migration: `sqlx::query!`/`query_as!` type-check your SQL
against a **live, already-migrated** database at compile time. A migration that only exists as a
`.sql` file — not yet applied via `sqlx migrate run` — is invisible to the compiler. If `cargo build`
suddenly complains a table or column "does not exist" right after adding a migration, this is almost
always why.

Tests live inline (`#[cfg(test)] mod tests { ... }`) next to the code they test, using
`#[sqlx::test]` for anything touching the database — each test gets its own fresh, fully-migrated
database, so they're safe to run in parallel.

## Docker

The day-to-day dev loop above (`cargo run` on the host, against a `docker compose up -d` Postgres)
is still the normal way to work on this. `docker-compose.yml` can also build and run the app
itself, behind a profile so it doesn't get pulled in by a plain `docker compose up`:

```
docker compose --profile app up -d --build
```

This builds `Dockerfile` — a multi-stage build, compiling in a full Rust image and running from a
slim Debian image with just the resulting binary — and starts it alongside Postgres, reachable at
`SERVER_PORT` the same as `cargo run`.

**If you change a query, you also need to update `.sqlx/`.** A Docker build has no live database to
check `sqlx::query!`/`query_as!` against, so it builds with `SQLX_OFFLINE=true` against a cached
snapshot of every query's shape (`.sqlx/`, committed to the repo) instead of the live-database
check `cargo build` normally does. Regenerate that cache after changing a query:
```
set -a; source .env; set +a && cargo sqlx prepare
```
A Docker build against a stale cache will still succeed — it just won't know about your change.
Local `cargo build`/`cargo test` are unaffected either way; they always check against the live
database, same as before.

## Project structure

- `src/lib.rs` — composes the app: config loading, the DB pool, background tasks, middleware layers,
  the router. `src/main.rs` is a two-line binary entry point that just calls `mfuse::run()`.
- `src/handlers/` — one file per route group (`secrets_handler.rs`, `auth_handler.rs`, `health.rs`).
- `src/structs/` — request/response DTOs (`api_secret.rs`), the DB row shape (`db_secret.rs`),
  shared app state (`app_state.rs`), the `CurrentUser` extractor (`current_user.rs`), OAuth config
  (`auth.rs`).
- `src/error.rs` — the `AppError` enum and its single `IntoResponse` impl.
- `src/cleanup.rs` — the background task that deletes expired secrets every minute.
- `src/config.rs`, `src/constants.rs`, `src/middleware.rs` — env/config loading, fixed Google OAuth
  endpoint URLs, and the security-headers middleware, respectively.
- `src/test_helpers.rs` — `#[cfg(test)]`-only shared test setup.
- `migrations/` — plain SQL, applied via `sqlx-cli`.
- `.sqlx/` — cached query metadata for Docker's offline build (see **Docker** above). Regenerate
  with `cargo sqlx prepare` after changing a query.
- `Dockerfile` — multi-stage build for the app itself; not part of the normal dev loop.

## Architecture notes

- **Handlers return `Result<_, AppError>` and use `?`, never hand-rolled status codes.** `AppError`
  (`src/error.rs`) centralizes logging (real error detail server-side via `tracing`, only a generic
  status code returned to the client) in one place instead of repeating that pattern at every call
  site.
- **Consuming a secret is one atomic query, not a check-then-delete.** `get_secret` runs a single
  `DELETE ... WHERE id = $1 AND expires_at > now() RETURNING ...` — a concurrent second request for
  the same id can't also match a row that's already gone, and an expired-but-not-yet-cleaned-up
  secret is rejected by the same query, not a separate check.
- **The server treats `ciphertext`/`nonce` as opaque bytes it never inspects.** All real encryption
  happens client-side (see `frontend/README.md`); this API's job is only ever to store and return
  bytes, base64-encoded over the wire.
