// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CopyButton from "./CopyButton";

const RESET_DELAY_MS = 2000;

// user-event's own setup() installs its own navigator.clipboard stub, so
// this has to run *after* userEvent.setup() to actually stick — and even
// then, capture a direct reference rather than re-reading
// navigator.clipboard.writeText later.
function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CopyButton", () => {
  it("copies the value and shows feedback", async () => {
    const user = userEvent.setup();
    const writeText = mockClipboard();
    render(<CopyButton value="secret-link" />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("secret-link");
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("uses a custom label when provided", () => {
    mockClipboard();
    render(<CopyButton value="secret-link" label="Copy link" />);
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });

  it("reverts to the label after the reset delay", async () => {
    // Plain fireEvent here, not userEvent — userEvent's internal pacing
    // doesn't mix well with fake timers, and this test only cares about the
    // timeout behavior, not interaction realism (the other two tests cover that).
    mockClipboard();
    vi.useFakeTimers();
    render(<CopyButton value="secret-link" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(RESET_DELAY_MS);
    });

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
