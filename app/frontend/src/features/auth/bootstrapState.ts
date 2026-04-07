const BOOTSTRAP_COMPLETED_KEY = "yealink-contacts-ui.bootstrap-password-changed";

export function hasCompletedBootstrapPasswordChange(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(BOOTSTRAP_COMPLETED_KEY) === "true";
}

export function markBootstrapPasswordChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(BOOTSTRAP_COMPLETED_KEY, "true");
}
