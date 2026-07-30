const NONCE_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
const PASSPHRASE_SALT_LENGTH_BYTES = 16;
const PBKDF2_ITERATIONS = 600_000;

export interface EncryptedSecret {
  ciphertextBase64: string;
  nonceBase64: string;
  keyBase64Url: string;
  passphraseSaltBase64?: string;
}

export interface DecryptOptions {
  passphrase?: string;
  passphraseSaltBase64?: string;
}

async function importRawAesKey(
  rawKeyBytes: Uint8Array<ArrayBuffer>,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    { name: "AES-GCM" },
    false,
    usages,
  );
}

// Combines the link's fragment key with a passphrase-derived value, so
// neither the link nor the passphrase alone is enough to decrypt — a leaked
// link still needs the (separately communicated) passphrase, and vice versa.
// The server only ever sees the salt; it never sees the passphrase or either key.
async function deriveCombinedKey(
  rawKeyBytes: Uint8Array<ArrayBuffer>,
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const passphraseKeyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const passphraseBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    passphraseKeyMaterial,
    256,
  );

  const ikmKey = await crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(passphraseBits),
      info: new Uint8Array(0),
    },
    ikmKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(
  plaintext: string,
  passphrase?: string,
): Promise<EncryptedSecret> {
  const rawKeyBytes = crypto.getRandomValues(new Uint8Array(KEY_LENGTH_BYTES));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES));
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const passphraseSalt = passphrase
    ? crypto.getRandomValues(new Uint8Array(PASSPHRASE_SALT_LENGTH_BYTES))
    : undefined;

  const aesKey =
    passphrase && passphraseSalt
      ? await deriveCombinedKey(rawKeyBytes, passphrase, passphraseSalt)
      : await importRawAesKey(rawKeyBytes, ["encrypt"]);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    plaintextBytes,
  );

  return {
    ciphertextBase64: new Uint8Array(ciphertextBuffer).toBase64(),
    nonceBase64: nonce.toBase64(),
    keyBase64Url: rawKeyBytes.toBase64({
      alphabet: "base64url",
      omitPadding: true,
    }),
    passphraseSaltBase64: passphraseSalt?.toBase64(),
  };
}

export async function decryptSecret(
  ciphertextBase64: string,
  nonceBase64: string,
  keyBase64Url: string,
  options?: DecryptOptions,
): Promise<string> {
  const keyBytes = Uint8Array.fromBase64(keyBase64Url, {
    alphabet: "base64url",
  });

  const aesKey =
    options?.passphrase && options?.passphraseSaltBase64
      ? await deriveCombinedKey(
          keyBytes,
          options.passphrase,
          Uint8Array.fromBase64(options.passphraseSaltBase64),
        )
      : await importRawAesKey(keyBytes, ["decrypt"]);

  const ciphertext = Uint8Array.fromBase64(ciphertextBase64);
  const nonce = Uint8Array.fromBase64(nonceBase64);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    ciphertext,
  );

  return new TextDecoder().decode(plaintextBuffer);
}
