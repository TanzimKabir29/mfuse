CREATE TABLE secrets (
    id UUID PRIMARY KEY,
    ciphertext BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
