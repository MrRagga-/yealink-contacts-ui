export type PasskeyLabelHints = {
  platform?: string;
  mobile?: boolean;
  deviceHostname?: string | null;
};

type NavigatorWithUaData = Navigator & {
  userAgentData?: {
    platform?: string;
    mobile?: boolean;
  };
};

export function readNavigatorHints(): Pick<PasskeyLabelHints, "platform" | "mobile"> {
  const uaData = (navigator as NavigatorWithUaData).userAgentData;
  return {
    platform: uaData?.platform,
    mobile: uaData?.mobile,
  };
}

/** Best-effort browser name from `navigator.userAgent` (no extra dependencies). */
export function detectBrowserName(userAgent: string): string {
  if (/Edg\//.test(userAgent)) {
    return "Edge";
  }
  if (/Firefox\//.test(userAgent)) {
    return "Firefox";
  }
  if (/Chrome\//.test(userAgent)) {
    return "Chrome";
  }
  if (/CriOS\//.test(userAgent)) {
    return "Chrome";
  }
  if (/Safari\//.test(userAgent)) {
    return "Safari";
  }
  return "Browser";
}

/** Best-effort OS / device class (laptop, phone, etc.). */
export function detectPlatformLabel(userAgent: string, hints: PasskeyLabelHints = {}): string {
  const platform = hints.platform?.trim();
  if (platform) {
    if (hints.mobile) {
      if (platform === "Android") {
        return "Android phone";
      }
      if (platform === "iOS") {
        return /iPad/.test(userAgent) ? "iPad" : "iPhone";
      }
      return platform;
    }
    return platform;
  }

  if (/iPhone|iPod/.test(userAgent)) {
    return "iPhone";
  }
  if (/iPad/.test(userAgent)) {
    return "iPad";
  }
  if (/Android/.test(userAgent)) {
    return /Mobile/.test(userAgent) ? "Android phone" : "Android tablet";
  }
  if (/Macintosh|Mac OS X/.test(userAgent)) {
    return "macOS";
  }
  if (/Windows/.test(userAgent)) {
    return "Windows";
  }
  if (/CrOS/.test(userAgent)) {
    return "ChromeOS";
  }
  if (/Linux/.test(userAgent)) {
    return "Linux";
  }
  return "Device";
}

function hostLabel(deviceHostname: string | null | undefined, siteHostname: string): string {
  const device = deviceHostname?.trim();
  if (device) {
    return device;
  }
  return siteHostname.trim() || "this site";
}

/** Suggested label shown before the user registers a passkey. */
export function suggestPasskeyLabel(
  siteHostname: string,
  userAgent: string,
  hints: PasskeyLabelHints = {},
): string {
  const browser = detectBrowserName(userAgent);
  const platform = detectPlatformLabel(userAgent, hints);
  const host = hostLabel(hints.deviceHostname, siteHostname);
  return `${browser} · ${platform} · ${host}`;
}
