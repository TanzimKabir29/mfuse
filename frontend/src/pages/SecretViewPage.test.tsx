// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test-utils";
import { encryptSecret } from "../lib/crypto";
import SecretViewPage from "./SecretViewPage";

const PASSPHRASE = "correct horse battery staple";

function mockGetSecret(response: {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
}) {
  const fetchMock = vi.fn().mockResolvedValue(response as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

describe("SecretViewPage", () => {
  it("shows the reveal prompt before anything is fetched", () => {
    mockGetSecret({ ok: false, status: 404 });

    renderWithProviders(<SecretViewPage />, {
      path: "/s/:id",
      initialEntries: ["/s/abc"],
    });

    expect(
      screen.getByRole("button", { name: "Reveal secret" }),
    ).toBeInTheDocument();
  });

  it("decrypts and shows the original secret when the key matches", async () => {
    const encrypted = await encryptSecret("hunter2");
    mockGetSecret({
      ok: true,
      status: 200,
      json: async () => ({
        ciphertext: encrypted.ciphertextBase64,
        nonce: encrypted.nonceBase64,
      }),
    });
    window.location.hash = encrypted.keyBase64Url;

    const user = userEvent.setup();
    renderWithProviders(<SecretViewPage />, {
      path: "/s/:id",
      initialEntries: ["/s/abc"],
    });

    await user.click(screen.getByRole("button", { name: "Reveal secret" }));

    expect(await screen.findByText("hunter2")).toBeInTheDocument();
  });

  it("shows an already-consumed message on a 404", async () => {
    mockGetSecret({ ok: false, status: 404 });
    window.location.hash = "some-key";

    const user = userEvent.setup();
    renderWithProviders(<SecretViewPage />, {
      path: "/s/:id",
      initialEntries: ["/s/abc"],
    });

    await user.click(screen.getByRole("button", { name: "Reveal secret" }));

    expect(
      await screen.findByText(/already been viewed, expired, or never existed/),
    ).toBeInTheDocument();
  });

  it("shows a corrupted-link message when the key doesn't decrypt the ciphertext", async () => {
    const encrypted = await encryptSecret("hunter2");
    const wrongKey = (await encryptSecret("something else")).keyBase64Url;
    mockGetSecret({
      ok: true,
      status: 200,
      json: async () => ({
        ciphertext: encrypted.ciphertextBase64,
        nonce: encrypted.nonceBase64,
      }),
    });
    window.location.hash = wrongKey;

    const user = userEvent.setup();
    renderWithProviders(<SecretViewPage />, {
      path: "/s/:id",
      initialEntries: ["/s/abc"],
    });

    await user.click(screen.getByRole("button", { name: "Reveal secret" }));

    expect(
      await screen.findByText(/corrupted or incomplete/),
    ).toBeInTheDocument();
  });

  it("prompts for a passphrase and decrypts once the correct one is entered", async () => {
    const encrypted = await encryptSecret("hunter2", PASSPHRASE);
    mockGetSecret({
      ok: true,
      status: 200,
      json: async () => ({
        ciphertext: encrypted.ciphertextBase64,
        nonce: encrypted.nonceBase64,
        passphrase_salt: encrypted.passphraseSaltBase64,
      }),
    });
    window.location.hash = encrypted.keyBase64Url;

    const user = userEvent.setup();
    renderWithProviders(<SecretViewPage />, {
      path: "/s/:id",
      initialEntries: ["/s/abc"],
    });

    await user.click(screen.getByRole("button", { name: "Reveal secret" }));

    const passphraseInput = await screen.findByPlaceholderText("Passphrase");
    expect(screen.queryByText("hunter2")).not.toBeInTheDocument();

    await user.type(passphraseInput, PASSPHRASE);
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("hunter2")).toBeInTheDocument();
  });

  it("rejects a wrong passphrase but lets the user try again", async () => {
    const encrypted = await encryptSecret("hunter2", PASSPHRASE);
    mockGetSecret({
      ok: true,
      status: 200,
      json: async () => ({
        ciphertext: encrypted.ciphertextBase64,
        nonce: encrypted.nonceBase64,
        passphrase_salt: encrypted.passphraseSaltBase64,
      }),
    });
    window.location.hash = encrypted.keyBase64Url;

    const user = userEvent.setup();
    renderWithProviders(<SecretViewPage />, {
      path: "/s/:id",
      initialEntries: ["/s/abc"],
    });

    await user.click(screen.getByRole("button", { name: "Reveal secret" }));

    await user.type(
      await screen.findByPlaceholderText("Passphrase"),
      "wrong guess",
    );
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText(/wrong passphrase/i)).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Passphrase"));
    await user.type(screen.getByPlaceholderText("Passphrase"), PASSPHRASE);
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("hunter2")).toBeInTheDocument();
  });
});
