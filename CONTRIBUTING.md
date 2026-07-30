# Contributing to MFuse

This is an internal tool with a small, deliberately narrow scope (see [`docs/`](docs/) for the full
design spec and non-goals). Before adding a feature, it's worth checking it actually serves "help
someone transmit a secret securely" — if not, it probably doesn't belong here.

## Before submitting a change

**Backend** (`backend/`):
```
cargo build
cargo fmt --check
cargo clippy
set -a; source .env; set +a && cargo test
```
`cargo test` needs `.env` sourced first — see [`backend/README.md`](backend/README.md#testing)
for why. If you add a migration, run `sqlx migrate run` against your local dev database *before*
running `cargo build` — the compile-time query macros check SQL against a live, already-migrated
database, not the migration files themselves. If you change a query, also run
`cargo sqlx prepare` and commit the resulting `.sqlx/` changes — see
[`backend/README.md`](backend/README.md#docker) for why.

**Frontend** (`frontend/`):
```
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run format:check
npm run test
```

All of the above should be clean before opening a PR.

## Conventions

- Backend errors go through the `AppError` enum (`backend/src/error.rs`) — add a variant rather
  than reaching for a bare `StatusCode` in a handler.
- Tests live inline (`#[cfg(test)] mod tests { ... }`) next to the code they test, not in a separate
  file. Database-touching tests use `#[sqlx::test]`, which gives each test its own isolated,
  pre-migrated database.
- Frontend components are plain function components; shared cross-page logic goes in
  `frontend/src/hooks/`, framework-agnostic utilities in `frontend/src/lib/`.
- Frontend tests live in a colocated `*.test.ts` file next to the code they test (e.g.
  `frontend/src/lib/crypto.test.ts`), using Vitest.
- Never commit a real `.env` — both `backend/` and `frontend/` have `.env.example` templates;
  keep those updated if you add a new environment variable.

## Commits

Keep commits reasonably scoped and describe *why*, not just *what* — the diff already shows what
changed.
