# MFuse

> **MFuse** — Secure One-Time Secret Sharing
>
> **Tagline:** *Every secret has a fuse.*


## Vision

MFuse is an internal utility focused on **secure transmission**, not credential management.

It exists to replace sending passwords and API keys over Slack, email, or documents with a secure, one-time, expiring link.

The product deliberately solves **one problem extremely well** and avoids feature creep.

## Goal

Build a **small, production-minded** web application that solves exactly one problem:

> Securely transmit a secret (typically a password) using a one-time, expiring link.

This is **not** a password manager.

## Non-goals

- No credential vault
- No folders
- No password generation
- No browser extension
- No secret history
- No organization management
- No permanent storage

## Tech Stack

### Backend
- Rust (stable)
- Axum
- Tokio
- SQLx
- PostgreSQL
- Serde
- tracing
- tower-http
- oauth2/OpenID Connect for Google Workspace login
- AES-256-GCM (or ChaCha20-Poly1305)
- rand

### Frontend
- React + Vite + TypeScript
- Tailwind CSS
- TanStack Query
- React Router

Keep the UI intentionally clean.

## Architecture

Browser
1. User signs in with Google.
2. User enters a secret.
3. Browser generates:
   - random encryption key
   - random IV/nonce
4. Browser encrypts the secret.
5. Browser uploads ONLY:
   - ciphertext
   - nonce
   - expiry
6. Server stores ciphertext.
7. URL returned:

https://secret.company.com/s/<id>#<key>

The fragment (#key) never reaches the server.

Recipient:
1. Opens URL.
2. Browser extracts key.
3. Downloads ciphertext.
4. Decrypts locally.
5. Server marks viewed and deletes immediately.
6. Refreshing the page shows "Secret already consumed."

## Functional Requirements

### Authentication
- Google Workspace OAuth login
- Store:
  - email
  - display name
  - Google subject ID

### Create Secret
Fields:
- Secret (textarea)
- Expiry:
  - 10 min
  - 1 hour
  - 24 hours
- Optional description (metadata only)

Returns:
- One-time URL
- Copy button

### View Secret
- Validate existence
- Reject expired
- Reject viewed
- Return ciphertext
- Mark consumed atomically
- Delete row

### Background Cleanup
Every minute:
- delete expired rows

## Database

users
- id
- google_subject
- email
- display_name
- created_at

secrets
- id (UUID)
- owner_id
- ciphertext
- nonce
- expires_at
- viewed_at nullable
- description nullable
- created_at

No plaintext secret.
No encryption key.
No URL fragment.

## Security

- HTTPS only
- CSP headers
- HSTS
- CSRF where applicable
- Rate limiting
- Max secret size: 16KB
- UUIDv4 IDs
- Constant-time comparisons where needed

## API

POST /api/secrets
GET /api/secrets/{id}
DELETE handled automatically after consume

GET /api/me

## Frontend

Pages:
- Login
- Create Secret
- Secret View
- Error / Expired

Create page:
- Large textarea
- Expiry selector
- Description
- Create button

After creation:
- Display generated link
- Copy button
- QR code (nice optional touch)

View page:
- Loading
- Secret revealed
- Copy button
- Warning:
  "This secret will disappear after this page."

After refresh:
- Secret has already been consumed.

## Nice UI touches

- Dark/light mode
- Smooth transitions
- Toast notifications
- Monospace display for secrets
- Syntax highlighting optional

## Rust Concepts to Demonstrate

- Ownership
- Borrowing
- Error handling with thiserror/anyhow
- Traits
- Async/Await
- SQLx compile-time queries
- Background tasks
- Middleware
- Dependency injection via state
- Structured logging

## Future Stretch Goals

- Burn after N views
- Optional passphrase
- Admin metrics (counts only)
- Docker Compose
- GitHub Actions CI
- Kubernetes deployment
- Terraform/CDK deployment


---

# Branding

## Product Name

**MFuse**

The name reflects the lifecycle of every secret:

1. A secret is created (the fuse is lit).
2. It exists only briefly.
3. It is either consumed once or expires.
4. It is permanently destroyed.

This should be reflected throughout the UI with subtle design cues rather than flashy animations.

## Design Language

Aim for a modern enterprise aesthetic similar to Linear, GitHub, or Vercel:

- Minimal UI
- Lots of whitespace
- Rounded cards
- Clean typography
- Dark mode first
- Subtle transitions
- Accent color inspired by an ember or warm orange
- Avoid skeuomorphic locks, shields, or vault imagery

The application should feel like an internal engineering tool, not a consumer password manager.

## Guiding Principle

Whenever a feature is proposed, ask:

> "Does this help users transmit a secret securely?"

If the answer is **no**, it probably does not belong in MFuse.
