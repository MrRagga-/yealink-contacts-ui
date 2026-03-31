import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AccessDeniedPage } from "./features/auth/AccessDeniedPage";
import { LoginPage } from "./features/auth/LoginPage";
import { PasswordChangePage } from "./features/auth/PasswordChangePage";
import { useAuth } from "./features/auth/AuthProvider";
import { ApiError } from "./lib/api";
import { DashboardPage } from "./pages/DashboardPage";
import { ContactsPage } from "./pages/ContactsPage";
import { ExportsPage } from "./pages/ExportsPage";
import { JobsPage } from "./pages/JobsPage";
import { RulesPage } from "./pages/RulesPage";
import { AboutPage } from "./pages/AboutPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SourcesPage } from "./pages/SourcesPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "sources", element: <SourcesPage /> },
      { path: "contacts", element: <ContactsPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "exports", element: <ExportsPage /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "about", element: <AboutPage /> },
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
