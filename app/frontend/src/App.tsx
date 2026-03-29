import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { Layout } from "./components/Layout";
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

export function App() {
  return <RouterProvider router={router} />;
}
