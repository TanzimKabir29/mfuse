// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCurrentUser } from "./useCurrentUser";

function createWrapper() {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

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

describe("useCurrentUser", () => {
  it("resolves with the logged-in user on success", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", email: "a@b.com", display_name: "A" }),
    });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      id: "1",
      email: "a@b.com",
      display_name: "A",
    });
  });

  it("does not retry when the request fails", async () => {
    const fetchMock = mockFetch({ ok: false, status: 401 });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // The hook sets retry: false deliberately (this is the "am I logged in"
    // check on every page) — if this regresses to the default 3 retries,
    // every logged-out visit gets visibly slower.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
