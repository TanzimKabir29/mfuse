// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test-utils";
import ErrorPage from "./ErrorPage";

describe("ErrorPage", () => {
  it("shows a not-found message and a link back home", () => {
    renderWithProviders(<ErrorPage />);

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
