import { useQuery } from "@tanstack/react-query";

import { QueryStatePanel } from "../components/QueryStatePanel";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { api } from "../lib/api";

export function DashboardPage() {
  const dashboardQuery = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const data = dashboardQuery.data;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Overview</span>
          <h2>Synchronization status</h2>
        </div>
      </header>
      {dashboardQuery.isPending ? (
        <QueryStatePanel
          message="Loading source counts, XML endpoints, and recent sync status."
          title="Loading dashboard"
          tone="loading"
        />
      ) : dashboardQuery.error ? (
        <QueryStatePanel
          message={(dashboardQuery.error as Error).message}
          title="Could not load dashboard"
          tone="error"
        />
      ) : data ? (
        <>
          <div className="stats-grid">
            <StatCard title="Sources" value={data.source_count} description={`${data.active_source_count} active`} />
            <StatCard title="Profile" value={data.export_profile_count} />
            <StatCard title="Contacts" value={data.contact_count} />
            <StatCard
              title="Exported"
              value={data.exported_contact_count}
              description={data.last_sync ? `Last sync: ${new Date(data.last_sync).toLocaleString()}` : "No sync yet"}
            />
          </div>
          <div className="two-column">
            <SectionCard title="XML endpoints">
              {data.xml_endpoints.length ? (
                <ul className="list">
                  {data.xml_endpoints.map((endpoint) => (
                    <li key={endpoint}>
                      <code>{endpoint}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <QueryStatePanel
                  message="Create an export profile to publish a Yealink XML endpoint."
                  title="No XML endpoints yet"
                />
              )}
            </SectionCard>
            <SectionCard title="Error status">
              {data.recent_errors.length ? (
                <ul className="list">
                  {data.recent_errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
                </ul>
              ) : (
                <QueryStatePanel message="No current source or export errors have been reported." title="Everything looks healthy" />
              )}
            </SectionCard>
          </div>
        </>
      ) : (
        <QueryStatePanel
          message="The dashboard did not return any data."
          title="No dashboard data available"
        />
      )}
    </div>
  );
}
