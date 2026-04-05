import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AccessDeniedPage } from "./features/auth/AccessDeniedPage";
import { LoginPage } from "./features/auth/LoginPage";
import { PasswordChangePage } from "./features/auth/PasswordChangePage";
import { useAuth } from "./features/auth/AuthProvider";
import { ApiError } from "./lib/api";

const DashboardPage = lazy(async () => ({ default: (await import("./pages/DashboardPage")).DashboardPage }));
const SourcesPage = lazy(async () => ({ default: (await import("./pages/SourcesPage")).SourcesPage }));
const ContactsPage = lazy(async () => ({ default: (await import("./pages/ContactsPage")).ContactsPage }));
const RulesPage = lazy(async () => ({ default: (await import("./pages/RulesPage")).RulesPage }));
const ExportsPage = lazy(async () => ({ default: (await import("./pages/ExportsPage")).ExportsPage }));
const JobsPage = lazy(async () => ({ default: (await import("./pages/JobsPage")).JobsPage }));
const SettingsPage = lazy(async () => ({ default: (await import("./pages/SettingsPage")).SettingsPage }));
const AboutPage = lazy(async () => ({ default: (await import("./pages/AboutPage")).AboutPage }));

function RouteLoadingScreen() {
  return (
    <div className="page">
      <section className="section-card">
        <span className="eyebrow">Loading</span>
        <h2>Preparing page</h2>
        <p className="subtle">Loading the next view and keeping your admin session active.</p>
      </section>
    </div>
  );
}

function withRouteSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoadingScreen />}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: withRouteSuspense(<DashboardPage />) },
      { path: "sources", element: withRouteSuspense(<SourcesPage />) },
      { path: "contacts", element: withRouteSuspense(<ContactsPage />) },
      { path: "rules", element: withRouteSuspense(<RulesPage />) },
      { path: "exports", element: withRouteSuspense(<ExportsPage />) },
      { path: "jobs", element: withRouteSuspense(<JobsPage />) },
      { path: "settings", element: withRouteSuspense(<SettingsPage />) },
      { path: "about", element: withRouteSuspense(<AboutPage />) },
    ],
  },
]);

function LoadingScreen() {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="eyebrow">Loading</span>
        <h1>Checking admin session</h1>
      </section>
    </main>
  );
}

function AuthErrorScreen({ error }: { error: ApiError }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="eyebrow">Error</span>
        <h1>Authentication bootstrap failed</h1>
        <p className="subtle">{error.message}</p>
      </section>
    </main>
  );
}

export function App() {
  const { user, error, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error?.status === 403) {
    return <AccessDeniedPage />;
  }

  if (error && error.status !== 401) {
    return <AuthErrorScreen error={error} />;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.must_change_password) {
    return <PasswordChangePage />;
  }

  return <RouterProvider router={router} />;
}
