# MFuse frontend

React/TypeScript/Vite frontend for MFuse — see the [root README](../README.md) for what the product
actually does, and [`backend/README.md`](../backend/README.md) for the API this talks to.

## Prerequisites

- Node.js — pinned via `.nvmrc` (currently 22.18.0); run `nvm use` if you use nvm
- A running backend — see [`backend/README.md`](../backend/README.md)

## Setup

```
cp .env.example .env
npm install
npm run dev
```

The dev server runs on whatever port `VITE_DEV_SERVER_PORT` is set to, and expects the backend at
`VITE_API_BASE_URL`. These must line up with the backend's own `SERVER_PORT` and `FRONTEND_ORIGIN` —
see the backend README for the full picture of how the two are wired together (CORS, cookies, etc.).

## Commands

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Dev server with hot reload                              |
| `npm run build`        | Type-checks (`tsc -b`) then produces a production build |
| `npm run lint`         | [Oxlint](https://oxc.rs/docs/guide/usage/linter.html)   |
| `npm run format`       | Format all files with Prettier                          |
| `npm run format:check` | Check formatting without writing changes (CI-style)     |
| `npm run test`         | Run the test suite (Vitest)                             |

Run `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run format:check`, and
`npm run test` before submitting a change — see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Testing

```
npm run test
```

Three layers of coverage:

- **Unit tests** for `src/lib/crypto.ts` (round trip, wrong-key rejection, tamper detection) and
  `src/lib/api.ts` (request shape, error mapping, the 204-no-body case). These run under Vitest's
  `node` environment — no DOM involved, just plain functions.
- **Component/hook tests**, using [React Testing Library](https://testing-library.com/), for
  `CopyButton`, `ThemeToggle` (+ `useTheme`), `useCurrentUser`, and `SecretQrCode`. These opt into a
  `jsdom` environment per file via a `// @vitest-environment jsdom` comment at the top of the file.
- **Page tests**, also under `jsdom`, for `ErrorPage`, `LoginPage`, `CreateSecretPage`, and
  `SecretViewPage`. `src/test-utils.tsx` has a shared `renderWithProviders()` helper, since every
  page needs both a `QueryClientProvider` and a router. The `CreateSecretPage`/`SecretViewPage`
  tests use the real `crypto.ts` (not a mock) to actually encrypt/decrypt, so they're proving the
  real create → upload → download → decrypt round trip works, not just that functions got called.

A few jsdom gotchas worth knowing about if you're adding to this:

- **jsdom doesn't implement `matchMedia`.** `src/test-setup.ts` shims it globally, since `useTheme`
  calls it on every mount (the default theme is `"system"` until something's been stored).
- **jsdom's `navigator.clipboard` fights back.** A plain assignment doesn't stick, and
  `userEvent.setup()` installs its own clipboard stub — so a test-local override has to happen
  _after_ `userEvent.setup()` runs, not before. See `CopyButton.test.tsx` for the pattern.
- **This project's pinned Node version (see `.nvmrc`) doesn't implement
  `Uint8Array.prototype.toBase64`/`fromBase64` yet**, even though every evergreen browser does.
  `src/test-setup.ts` polyfills both, built on `atob`/`btoa` so it doesn't need anything beyond
  this project's existing DOM lib types. This only affects the test run — the app itself only ever
  executes `crypto.ts` in a real browser.
- **`MemoryRouter` doesn't touch the real `window.location`.** `SecretViewPage` reads
  `window.location.hash` directly (not through a router hook), so its tests set
  `window.location.hash` on the real jsdom `window` themselves, separately from whatever path
  `MemoryRouter`'s `initialEntries` renders. Reset it in `afterEach`, or it leaks into the next test.

## Project structure

- `src/pages/` — one file per route (`CreateSecretPage.tsx`, `SecretViewPage.tsx`,
  `LoginPage.tsx`, `ErrorPage.tsx`).
- `src/components/` — shared UI: `Layout.tsx` (the persistent theme toggle / logout chrome),
  `CopyButton.tsx`, `ThemeToggle.tsx`, `LogoutButton.tsx`, `SecretQrCode.tsx` (renders a created
  secret's link as a scannable QR code).
- `src/hooks/` — cross-page logic: `useCurrentUser.ts`, `useTheme.ts`.
- `src/lib/` — framework-agnostic utilities: `api.ts` (the typed backend client), `crypto.ts` (the
  actual encryption/decryption).

## Architecture notes

**The client-side crypto is the whole point of this app.** `src/lib/crypto.ts` generates a random
AES-256-GCM key and nonce, encrypts the secret entirely in the browser, and only ever sends
ciphertext + nonce to the backend — the encryption key itself is embedded in the URL as a fragment
(`#...`), which browsers never transmit to any server. The backend genuinely cannot read a secret's
contents; it stores and returns opaque bytes. Reading `src/lib/crypto.ts` alongside
`src/pages/CreateSecretPage.tsx` (encrypt → upload) and `src/pages/SecretViewPage.tsx`
(download → decrypt) is the fastest way to understand how the app actually works.

If a passphrase is set, `crypto.ts` doesn't use it in place of the fragment key — it PBKDF2-derives
a value from the passphrase and HKDF-combines that with the fragment key to get the actual AES-GCM
key. Neither the link nor the passphrase alone is enough to decrypt; a leaked link is still useless
without the (separately shared) passphrase. The backend only ever sees the random salt this
requires; it never sees the passphrase or either key.

Other notable pieces:

- `src/lib/api.ts` — a thin typed `fetch` wrapper. Every request sends `credentials: "include"` so
  the session cookie travels with it.
- `src/hooks/useCurrentUser.ts` — the shared "am I logged in" query, used both by page-level auth
  guards and by `src/components/Layout.tsx` to conditionally show the logout button.
- `src/hooks/useTheme.ts` — light/dark/system theme, persisted to `localStorage`, applied via a
  `.dark` class rather than relying solely on `prefers-color-scheme` (so a manual choice can
  override the OS setting).
