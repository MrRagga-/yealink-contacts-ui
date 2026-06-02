import { readNavigatorHints, suggestPasskeyLabel, type PasskeyLabelHints } from "./suggestPasskeyLabel";
import type { PasskeySuggestedLabel } from "../../types/api";

export function buildPasskeyLabelFromBrowser(hints: PasskeyLabelHints = {}) {
  return suggestPasskeyLabel(window.location.hostname, navigator.userAgent, {
    ...readNavigatorHints(),
    ...hints,
  });
}

export function buildPasskeyLabel(suggested?: PasskeySuggestedLabel | null) {
  return suggestPasskeyLabel(
    suggested?.site_hostname ?? window.location.hostname,
    navigator.userAgent,
    {
      ...readNavigatorHints(),
      deviceHostname: suggested?.device_hostname,
    },
  );
}
