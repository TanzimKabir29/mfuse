# MFuse

*Every secret has a fuse.*

MFuse is a simple internal tool for sending a secret, like a password or an API key, to someone one
time only. You paste it in, get a link back, and send that link. The first person who opens it sees
the secret. Anyone who opens it after that just sees "already consumed." Nothing sits around
afterward in a Slack thread, an email, or a shared doc.

## Why this exists

Normally, when someone needs to send a password or a key, they just type it into whatever chat app
is open. Slack, email, a shared doc, whatever. And then it just stays there. It's in the message
history. It's in search. It's in every backup of that channel, forever, for anyone with access to
find later.

MFuse fixes that part. The secret can only be read once, and then it's gone. Even MFuse itself
can't read what you send.

## What it does

- **One-time links.** A secret can be opened exactly once. As soon as someone opens it, the server
  deletes it right away. There's no going back to view it again.
- **Expiry.** Secrets also expire on their own after a set time, so even an unopened link doesn't
  sit around forever.
- **Encryption happens in your browser.** The secret gets encrypted before it ever leaves your
  computer. The server only ever stores scrambled bytes it can't read. See [How it works](#how-it-works)
  for why.
- **Google sign-in.** You need a Google account to create a secret. Opening a link doesn't need one,
  so you can send it to anyone.
- **Optional passphrase.** For extra protection, you can add a passphrase that has to be shared
  separately from the link (over the phone, say). That way, if the link alone leaks somewhere, it's
  still not enough on its own.

MFuse isn't trying to be a password manager. No vault, no folders, no saved history, no team
management. It does one job: get a secret from one person to another without leaving a trace.
If a new feature doesn't help with that, it probably doesn't belong here.

## How it works

The server never actually sees your secret, or the key used to encrypt it. Here's how that works:

1. Your browser makes a random encryption key and nonce, and encrypts the secret right there,
   before anything gets sent anywhere.
2. Only the encrypted bytes get uploaded. The server just stores them as-is. It has no way to read
   them.
3. The link you get back has the encryption key in it, but after a `#` symbol
   (something like `https://.../s/<id>#<key>`). Browsers never send anything after a `#` to a
   server. So the key never actually reaches MFuse.
4. When someone opens the link, the browser grabs the encrypted data, decrypts it locally, and the
   server deletes that row at the same time. Open the link again and it's already gone.

Since the key only ever lives in the browser and in the link itself, even if someone got into
MFuse's database, all they'd find is scrambled data with no key anywhere near it.

If a passphrase is set, it doesn't replace the key in the link, it combines with it. So neither
the link by itself nor the passphrase by itself is enough. Someone would need both.

## Under the hood

The backend is written in Rust with Axum, and stores its data in Postgres. The frontend is React
and TypeScript, and that's where the actual encryption happens, using the browser's built-in Web
Crypto API. The two sides talk over a small JSON API, and Google handles sign-in.

See [Repo layout](#repo-layout) below for where everything lives. Each part has its own README with
more detail if you want it.

## Repo layout

- [`backend/`](backend/): Rust/Axum API, Postgres, Google OAuth. See
  [`backend/README.md`](backend/README.md) to run it.
- [`frontend/`](frontend/): React/TypeScript/Vite UI, including the client-side crypto. See
  [`frontend/README.md`](frontend/README.md) to run it.
- [`docs/`](docs/): the original design spec.

## Getting started

Each sub-project has its own README with prerequisites, setup steps, and available commands:

- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Proprietary. See [LICENSE](LICENSE).
