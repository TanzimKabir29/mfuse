// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SecretQrCode from "./SecretQrCode";

describe("SecretQrCode", () => {
  it("renders a QR code image for the given value", async () => {
    render(<SecretQrCode value="https://example.com/s/abc#key" />);

    const img = await screen.findByAltText("QR code for the secret link");
    expect((img as HTMLImageElement).src).toMatch(/^data:image\/png;base64,/);
  });

  it("renders nothing before the QR code has generated", () => {
    render(<SecretQrCode value="https://example.com/s/abc#key" />);

    // Immediately after the synchronous render, QRCode.toDataURL (async)
    // hasn't resolved yet, so there should be no image in the DOM.
    expect(
      screen.queryByAltText("QR code for the secret link"),
    ).not.toBeInTheDocument();
  });
});
