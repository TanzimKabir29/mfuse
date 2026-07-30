// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test-utils";
import { decryptSecret } from "../lib/crypto";
import CreateSecretPage from "./CreateSecretPage";

const ME_RESPONSE = { id: "1", email: "a@b.com", display_name: "A" };

function mockBackend({
  secretSucceeds = true,
}: { secretSucceeds?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string, _options: RequestInit) => {
    if (url.includes("/me")) {
      return {
        ok: true,
        status: 200,
        json: async () => ME_RESPONSE,
      } as unknown as Response;
    }
    if (url.includes("/secret")) {
      if (!secretSucceeds) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "secret-id-123" }),
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch call: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockLoggedOut() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CreateSecretPage", () => {
  it("redirects to /login when not authenticated", async () => {
    mockLoggedOut();

    renderWithProviders(<CreateSecretPage />, {
      path: "/create",
      initialEntries: ["/create"],
      routes: { "/login": <div>Login page</div> },
    });

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("disables submit until the secret has content", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderWithProviders(<CreateSecretPage />);

    await screen.findByRole("button", { name: "Create secret" });
    expect(
      screen.getByRole("button", { name: "Create secret" }),
    ).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText("Paste the secret here"),
      "hunter2",
    );

    expect(screen.getByRole("button", { name: "Create secret" })).toBeEnabled();
  });

  it("encrypts, uploads, and produces a link that actually decrypts back to the original text", async () => {
    const fetchMock = mockBackend();
    const user = userEvent.setup();
    renderWithProviders(<CreateSecretPage />);

    await user.type(
      await screen.findByPlaceholderText("Paste the secret here"),
      "hunter2",
    );
    await user.click(screen.getByRole("button", { name: "Create secret" }));

    const urlInput = (await screen.findByDisplayValue(
      /\/s\//,
    )) as HTMLInputElement;

    const secretCall = fetchMock.mock.calls.find(([url]) =>
      url.includes("/secret"),
    );
    expect(secretCall).toBeDefined();
    const [, options] = secretCall!;
    const body = JSON.parse(options.body as string);

    expect(body.expiry).toBe("one_hour");

    const key = urlInput.value.split("#")[1];
    const decrypted = await decryptSecret(body.ciphertext, body.nonce, key);
    expect(decrypted).toBe("hunter2");

    const qrCode = await screen.findByAltText("QR code for the secret link");
    expect((qrCode as HTMLImageElement).src).toMatch(
      /^data:image\/png;base64,/,
    );
  });

  it("passphrase-protects the secret: uploads a salt, and requires the passphrase to decrypt", async () => {
    const fetchMock = mockBackend();
    const user = userEvent.setup();
    renderWithProviders(<CreateSecretPage />);

    await user.type(
      await screen.findByPlaceholderText("Paste the secret here"),
      "hunter2",
    );
    await user.type(
      screen.getByPlaceholderText("Share this separately from the link"),
      "correct horse battery staple",
    );
    await user.click(screen.getByRole("button", { name: "Create secret" }));

    expect(
      await screen.findByText(/don't forget to share the passphrase/i),
    ).toBeInTheDocument();

    const urlInput = (await screen.findByDisplayValue(
      /\/s\//,
    )) as HTMLInputElement;
    const secretCall = fetchMock.mock.calls.find(([url]) =>
      url.includes("/secret"),
    );
    const [, options] = secretCall!;
    const body = JSON.parse(options.body as string);
    expect(body.passphrase_salt).toBeDefined();

    const key = urlInput.value.split("#")[1];

    const decrypted = await decryptSecret(body.ciphertext, body.nonce, key, {
      passphrase: "correct horse battery staple",
      passphraseSaltBase64: body.passphrase_salt,
    });
    expect(decrypted).toBe("hunter2");

    await expect(
      decryptSecret(body.ciphertext, body.nonce, key, {
        passphrase: "wrong guess",
        passphraseSaltBase64: body.passphrase_salt,
      }),
    ).rejects.toThrow();
  });

  it("shows an error message when the upload fails", async () => {
    mockBackend({ secretSucceeds: false });
    const user = userEvent.setup();
    renderWithProviders(<CreateSecretPage />);

    await user.type(
      await screen.findByPlaceholderText("Paste the secret here"),
      "hunter2",
    );
    await user.click(screen.getByRole("button", { name: "Create secret" }));

    expect(
      await screen.findByText(/something went wrong/i),
    ).toBeInTheDocument();
  });
});
