import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createSecret, getMe, getSecret, logout } from "./api";

function mockFetch(response: {
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
});

describe("api client", () => {
  it("sends credentials and a JSON content-type, and returns parsed JSON on success", async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        id: "abc-123",
        email: "a@b.com",
        display_name: "A",
      }),
    });

    const me = await getMe();

    expect(me).toEqual({ id: "abc-123", email: "a@b.com", display_name: "A" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/me$/),
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "Content-type": "application/json",
        }),
      }),
    );
  });

  it("sends a POST body when creating a secret", async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ id: "secret-1" }),
    });

    const payload = {
      ciphertext: "Y2lwaGVy",
      nonce: "bm9uY2U=",
      expiry: "one_hour" as const,
    };
    const result = await createSecret(payload);

    expect(result).toEqual({ id: "secret-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/secret$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("throws ApiError with the response status when the request fails", async () => {
    mockFetch({ ok: false, status: 404 });

    const error = await getSecret("missing-id").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404 });
  });

  it("resolves to undefined on a 204 response without parsing a body", async () => {
    const json = vi.fn();
    mockFetch({ ok: true, status: 204, json });

    const result = await logout();

    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});
