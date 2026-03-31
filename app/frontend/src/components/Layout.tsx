import { useMutation } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../features/auth/AuthProvider";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";

export function Layout() {
  const { user, clearAuth, refresh } = useAuth();
  const toast = useToast();
  const { locale, setLocale, t } = useI18n();
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      clearAuth();
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });
  const navItems = [
    { to: "/", label: t("dashboard"), end: true },
    { to: "/sources", label: t("sources") },
    { to: "/contacts", label: t("contacts") },
    { to: "/rules", label: t("rules") },
    { to: "/exports", label: t("exports") },
    { to: "/jobs", label: t("jobs") },
    { to: "/settings", label: t("settings") },
    { to: "/about", label: t("about") },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <img src="/logo-mark.svg" alt="Yealink Contacts Sync logo" className="brand-logo" />
          </span>
          <div>
            <h1>{t("appTitle")}</h1>
            <p>{t("appTagline")}</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="auth-sidebar-card">
            <strong>{user?.username}</strong>
            <p>Admin session</p>
            <button type="button" className="ghost-button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
              {logoutMutation.isPending ? "Signing out..." : "Sign out"}
            </button>
          </div>
          <label className="language-switcher">
            <span>{t("language")}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as "en" | "de")}>
              <option value="en">{t("english")}</option>
              <option value="de">{t("german")}</option>
            </select>
          </label>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
