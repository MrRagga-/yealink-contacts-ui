import { useQuery } from "@tanstack/react-query";

import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { api } from "../lib/api";

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Overview</span>
          <h2>Synchronization status</h2>
        </div>
      </header>
      <div className="stats-grid">
        <StatCard title="Sources" value={data?.source_count ?? 0} description={`${data?.active_source_count ?? 0} active`} />
        <StatCard title="Profile" value={data?.export_profile_count ?? 0} />
        <StatCard title="Contacts" value={data?.contact_count ?? 0} />
        <StatCard title="Exported" value={data?.exported_contact_count ?? 0} description={data?.last_sync ? `Last sync: ${new Date(data.last_sync).toLocaleString()}` : "No sync yet"} />
      </div>
      <div className="two-column">
        <SectionCard title="XML endpoints">
          <ul className="list">
            {data?.xml_endpoints.map((endpoint) => (
              <li key={endpoint}>
                <code>{endpoint}</code>
              </li>
            )) ?? <li>No export profiles available yet.</li>}
          </ul>
        </SectionCard>
        <SectionCard title="Error status">
          <ul className="list">
            {data?.recent_errors.length ? data.recent_errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>) : <li>No current errors.</li>}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
