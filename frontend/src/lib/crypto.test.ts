import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext secret", async () => {
    const encrypted = await encryptSecret("hunter2");
    const decrypted = await decryptSecret(
      encrypted.ciphertextBase64,
      encrypted.nonceBase64,
      encrypted.keyBase64Url,
    );

    expect(decrypted).toBe("hunter2");
  });

  it("round-trips multi-byte unicode text", async () => {
    const plaintext = "pässwörd 🔒 日本語";
    const encrypted = await encryptSecret(plaintext);
    const decrypted = await decryptSecret(
      encrypted.ciphertextBase64,
      encrypted.nonceBase64,
      encrypted.keyBase64Url,
    );

    expect(decrypted).toBe(plaintext);
  });

  it("round-trips an empty string", async () => {
    const encrypted = await encryptSecret("");
    const decrypted = await decryptSecret(
      encrypted.ciphertextBase64,
      encrypted.nonceBase64,
      encrypted.keyBase64Url,
    );

    expect(decrypted).toBe("");
  });

  it("generates a different key and nonce on every call", async () => {
    const first = await encryptSecret("same plaintext");
    const second = await encryptSecret("same plaintext");

    expect(first.keyBase64Url).not.toBe(second.keyBase64Url);
    expect(first.nonceBase64).not.toBe(second.nonceBase64);
    expect(first.ciphertextBase64).not.toBe(second.ciphertextBase64);
  });

  it("fails to decrypt with the wrong key", async () => {
    const encrypted = await encryptSecret("hunter2");
    const other = await encryptSecret("something else");

    await expect(
      decryptSecret(
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        other.keyBase64Url,
      ),
    ).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const encrypted = await encryptSecret("hunter2");
    const tamperedBytes = Uint8Array.fromBase64(encrypted.ciphertextBase64);
    tamperedBytes[0] ^= 0xff;

    await expect(
      decryptSecret(
        tamperedBytes.toBase64(),
        encrypted.nonceBase64,
        encrypted.keyBase64Url,
      ),
    ).rejects.toThrow();
  });

  it("does not set a passphrase salt when no passphrase is given", async () => {
    const encrypted = await encryptSecret("hunter2");
    expect(encrypted.passphraseSaltBase64).toBeUndefined();
  });
});

describe("passphrase-protected secrets", () => {
  it("round-trips when the correct passphrase is supplied", async () => {
    const encrypted = await encryptSecret(
      "hunter2",
      "correct horse battery staple",
    );
    expect(encrypted.passphraseSaltBase64).toBeDefined();

    const decrypted = await decryptSecret(
      encrypted.ciphertextBase64,
      encrypted.nonceBase64,
      encrypted.keyBase64Url,
      {
        passphrase: "correct horse battery staple",
        passphraseSaltBase64: encrypted.passphraseSaltBase64,
      },
    );

    expect(decrypted).toBe("hunter2");
  });

  it("fails to decrypt with the wrong passphrase", async () => {
    const encrypted = await encryptSecret(
      "hunter2",
      "correct horse battery staple",
    );

    await expect(
      decryptSecret(
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        encrypted.keyBase64Url,
        {
          passphrase: "wrong passphrase",
          passphraseSaltBase64: encrypted.passphraseSaltBase64,
        },
      ),
    ).rejects.toThrow();
  });

  it("fails to decrypt with the right passphrase but the wrong fragment key", async () => {
    const encrypted = await encryptSecret(
      "hunter2",
      "correct horse battery staple",
    );
    const other = await encryptSecret(
      "something else",
      "correct horse battery staple",
    );

    await expect(
      decryptSecret(
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        other.keyBase64Url,
        {
          passphrase: "correct horse battery staple",
          passphraseSaltBase64: encrypted.passphraseSaltBase64,
        },
      ),
    ).rejects.toThrow();
  });

  it("fails to decrypt as if no passphrase were given at all", async () => {
    const encrypted = await encryptSecret(
      "hunter2",
      "correct horse battery staple",
    );

    await expect(
      decryptSecret(
        encrypted.ciphertextBase64,
        encrypted.nonceBase64,
        encrypted.keyBase64Url,
      ),
    ).rejects.toThrow();
  });
});
