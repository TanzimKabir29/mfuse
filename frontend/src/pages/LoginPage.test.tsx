// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test-utils";
import LoginPage from "./LoginPage";

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

describe("LoginPage", () => {
  it("shows a loading state before the session check resolves", () => {
    mockFetch({ ok: false, status: 401 });

    renderWithProviders(<LoginPage />);

    expect(screen.getByText("Checking session...")).toBeInTheDocument();
  });

  it("shows the Google sign-in link when logged out", async () => {
    mockFetch({ ok: false, status: 401 });

    renderWithProviders(<LoginPage />);

    const link = await screen.findByRole("link", {
      name: "Sign in with Google",
    });
    expect(link.getAttribute("href")).toContain("/auth/google/login");
  });

  it("redirects to / when already logged in", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", email: "a@b.com", display_name: "A" }),
    });

    renderWithProviders(<LoginPage />, {
      path: "/login",
      initialEntries: ["/login"],
      routes: { "/": <div>Home page</div> },
    });

    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
