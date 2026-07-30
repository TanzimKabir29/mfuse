// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import ThemeToggle from "./ThemeToggle";

const STORAGE_KEY = "mfuse-theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("ThemeToggle", () => {
  it("defaults to system when nothing is stored", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "system" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The matchMedia shim in test-setup.ts reports no dark preference.
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("switches to light: removes the dark class and persists the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "light" }));

    expect(screen.getByRole("button", { name: "light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("switches to dark: applies the dark class and persists the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "dark" }));

    expect(screen.getByRole("button", { name: "dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("picks the persisted theme back up on remount", () => {
    localStorage.setItem(STORAGE_KEY, "dark");

    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement).toHaveClass("dark");
  });
});
