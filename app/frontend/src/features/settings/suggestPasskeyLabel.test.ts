import { describe, expect, it } from "vitest";

import {
  detectBrowserName,
  detectPlatformLabel,
  suggestPasskeyLabel,
} from "./suggestPasskeyLabel";

describe("suggestPasskeyLabel", () => {
  it("detects common browsers", () => {
    expect(detectBrowserName("Mozilla/5.0 Firefox/128.0")).toBe("Firefox");
    expect(detectBrowserName("Mozilla/5.0 Chrome/128.0 Safari/537.36")).toBe("Chrome");
    expect(detectBrowserName("Mozilla/5.0 Edg/128.0")).toBe("Edge");
  });

  it("detects platforms from user agent", () => {
    expect(detectPlatformLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/128.0")).toBe("macOS");
    expect(detectPlatformLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0")).toBe("Windows");
    expect(detectPlatformLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("iPhone");
  });

  it("uses Client Hints when available", () => {
    expect(
      detectPlatformLabel("Mozilla/5.0", { platform: "Android", mobile: true }),
    ).toBe("Android phone");
    expect(
      detectPlatformLabel("Mozilla/5.0 (iPad; CPU OS 17_0)", { platform: "iOS", mobile: true }),
    ).toBe("iPad");
  });

  it("prefers device hostname over site hostname", () => {
    expect(
      suggestPasskeyLabel("yealink-contacts-ui.weismueller.org", "Mozilla/5.0 Firefox/128.0", {
        platform: "macOS",
        mobile: false,
        deviceHostname: "jonas-macbook.local",
      }),
    ).toBe("Firefox · macOS · jonas-macbook.local");
  });

  it("falls back to site hostname when device hostname is unknown", () => {
    expect(suggestPasskeyLabel("localhost", "Mozilla/5.0 (Windows NT 10.0) Chrome/128.0")).toBe(
      "Chrome · Windows · localhost",
    );
  });
});
