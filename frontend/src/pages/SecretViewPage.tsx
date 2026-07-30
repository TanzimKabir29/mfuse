import { useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { ApiError, getSecret, type GetSecretResponse } from "../lib/api";
import { decryptSecret } from "../lib/crypto";
import { useMutation } from "@tanstack/react-query";
import CopyButton from "../components/CopyButton";

async function fetchSecret(id: string | undefined): Promise<GetSecretResponse> {
  if (!id) {
    throw new Error("missing secret id");
  }

  if (!window.location.hash.slice(1)) {
    throw new Error("missing key in the URL fragment");
  }

  return getSecret(id);
}

async function decryptFetchedSecret(
  fetched: GetSecretResponse,
  passphrase: string,
): Promise<string> {
  const key = window.location.hash.slice(1);
  return decryptSecret(fetched.ciphertext, fetched.nonce, key, {
    passphrase: passphrase.trim() || undefined,
    passphraseSaltBase64: fetched.passphrase_salt,
  });
}

function SecretViewPage() {
  const { id } = useParams();
  const [passphrase, setPassphrase] = useState("");

  const decryptMutation = useMutation({
    mutationFn: (variables: {
      fetched: GetSecretResponse;
      passphrase: string;
    }) => decryptFetchedSecret(variables.fetched, variables.passphrase),
  });

  const fetchMutation = useMutation({
    mutationFn: () => fetchSecret(id),
    onSuccess: (data) => {
      if (!data.passphrase_salt) {
        decryptMutation.mutate({ fetched: data, passphrase: "" });
      }
    },
  });

  const isConsumed =
    fetchMutation.error instanceof ApiError &&
    fetchMutation.error.status === 404;
  const requiresPassphrase = !!fetchMutation.data?.passphrase_salt;
  const awaitingPassphrase = requiresPassphrase && !decryptMutation.isSuccess;

  function handlePassphraseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fetchMutation.data) {
      decryptMutation.mutate({ fetched: fetchMutation.data, passphrase });
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-lg flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold">Secret</h1>

        {fetchMutation.status === "idle" && (
          <>
            <p className="text-ink-muted text-sm">
              This secret can only be viewed once. It will disappear immediately
              after this page.
            </p>
            <button
              type="button"
              onClick={() => fetchMutation.mutate()}
              className="rounded-md bg-accent text-accent-contrast px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-all active:scale-95"
            >
              Reveal secret
            </button>
          </>
        )}

        {fetchMutation.isPending && (
          <p className="text-ink-muted text-sm">Fetching...</p>
        )}

        {fetchMutation.isSuccess &&
          !requiresPassphrase &&
          !decryptMutation.isSuccess &&
          !decryptMutation.isError && (
            <p className="text-ink-muted text-sm">Decrypting...</p>
          )}

        {fetchMutation.isSuccess && awaitingPassphrase && (
          <form
            onSubmit={handlePassphraseSubmit}
            className="flex flex-col gap-3"
          >
            <p className="text-ink-muted text-sm">
              This secret is passphrase-protected. Enter the passphrase you were
              given separately.
            </p>
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Passphrase"
              autoFocus
              className="rounded-md bg-surface border border-line px-3 py-2 text-sm text-ink"
            />
            <button
              type="submit"
              disabled={decryptMutation.isPending}
              className="rounded-md bg-accent text-accent-contrast px-4 py-2 text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {decryptMutation.isPending ? "Decrypting..." : "Unlock"}
            </button>
            {decryptMutation.isError && (
              <p className="text-danger text-sm">
                Wrong passphrase. Try again.
              </p>
            )}
          </form>
        )}

        {decryptMutation.isSuccess && (
          <>
            <div className="rounded-md bg-surface border border-line px-3 py-3 text-left font-mono text-sm whitespace-pre-wrap wrap-break-word">
              {decryptMutation.data}
            </div>
            <CopyButton value={decryptMutation.data} />
            <p className="text-ink-muted text-xs">
              This secret has now been permanently deleted from the server.
            </p>
          </>
        )}

        {fetchMutation.isError && isConsumed && (
          <p className="text-ink-muted text-sm">
            This secret has already been viewed, expired, or never existed.
          </p>
        )}

        {fetchMutation.isError && !isConsumed && (
          <p className="text-danger text-sm">
            This link appears to be corrupted or incomplete — the secret
            couldn't be decrypted.
          </p>
        )}

        {decryptMutation.isError && !requiresPassphrase && (
          <p className="text-danger text-sm">
            This link appears to be corrupted or incomplete — the secret
            couldn't be decrypted.
          </p>
        )}
      </div>
    </div>
  );
}

export default SecretViewPage;
