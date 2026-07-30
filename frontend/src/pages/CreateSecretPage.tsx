import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { createSecret, type SecretExpiry } from "../lib/api";
import { encryptSecret } from "../lib/crypto";
import { useCurrentUser } from "../hooks/useCurrentUser";
import CopyButton from "../components/CopyButton";
import SecretQrCode from "../components/SecretQrCode";

async function submitSecret(input: {
  secret: string;
  description: string;
  expiry: SecretExpiry;
  passphrase: string;
}): Promise<{ url: string }> {
  const encrypted = await encryptSecret(
    input.secret,
    input.passphrase.trim() || undefined,
  );
  const response = await createSecret({
    ciphertext: encrypted.ciphertextBase64,
    nonce: encrypted.nonceBase64,
    description: input.description.trim() || undefined,
    expiry: input.expiry,
    passphrase_salt: encrypted.passphraseSaltBase64,
  });

  const url = `${window.location.origin}/s/${response.id}#${encrypted.keyBase64Url}`;
  return { url };
}

function CreateSecretPage() {
  const currentUser = useCurrentUser();
  const [secret, setSecret] = useState("");
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState<SecretExpiry>("one_hour");
  const [passphrase, setPassphrase] = useState("");

  const mutation = useMutation({ mutationFn: submitSecret });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ secret, description, expiry, passphrase });
  }

  if (currentUser.isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center">
        <p className="text-ink-muted text-sm">Checking session...</p>
      </div>
    );
  }

  if (currentUser.isError) {
    return <Navigate to="/login" replace />;
  }

  if (mutation.data) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
        <div className="w-full max-w-lg flex flex-col gap-4 text-center">
          <h1 className="text-2xl font-semibold">Secret created</h1>
          <p className="text-ink-muted text-sm">
            This link works once. Share it carefully — anyone who opens it
            consumes it.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={mutation.data.url}
              className="flex-1 rounded-md bg-surface border border-line px-3 py-2 text-sm text-ink"
            />
            <CopyButton value={mutation.data.url} />
          </div>
          <SecretQrCode value={mutation.data.url} />
          {mutation.variables?.passphrase.trim() && (
            <p className="text-ink-muted text-xs">
              Don't forget to share the passphrase too — separately from this
              link.
            </p>
          )}
          <button
            type="button"
            onClick={() => mutation.reset()}
            className="text-sm text-ink-muted hover:text-ink"
          >
            Create another secret
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg flex flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold">Create a secret</h1>

        <textarea
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="Paste the secret here"
          rows={6}
          className="w-full rounded-md bg-surface border border-line px-3 py-2 text-sm text-ink font-mono"
        />

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Expires after
          <select
            value={expiry}
            onChange={(event) => setExpiry(event.target.value as SecretExpiry)}
            className="rounded-md bg-surface border border-line px-3 py-2 text-ink"
          >
            <option value="ten_minutes">10 minutes</option>
            <option value="one_hour">1 hour</option>
            <option value="twenty_four_hours">24 hours</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Description (optional)
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. staging DB password"
            className="rounded-md bg-surface border border-line px-3 py-2 text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Passphrase (optional)
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Share this separately from the link"
            className="rounded-md bg-surface border border-line px-3 py-2 text-ink"
          />
        </label>

        <button
          type="submit"
          disabled={secret.trim().length === 0 || mutation.isPending}
          className="rounded-md bg-accent text-accent-contrast px-4 py-2 text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          {mutation.isPending ? "Encrypting & creating..." : "Create secret"}
        </button>

        {mutation.isError && (
          <p className="text-sm text-danger">
            Something went wrong (
            {mutation.error instanceof Error
              ? mutation.error.message
              : "unknown error"}
            ).
          </p>
        )}
      </form>
    </div>
  );
}

export default CreateSecretPage;
