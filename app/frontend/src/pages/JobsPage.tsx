import { useQuery } from "@tanstack/react-query";

import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

export function JobsPage() {
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: api.getJobs });
  const { data: logs } = useQuery({ queryKey: ["logs"], queryFn: api.getLogs });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">History</span>
          <h2>Sync jobs and audit logs</h2>
        </div>
      </header>
      <div className="two-column">
        <SectionCard title="Sync jobs">
          <div className="stack">
            {jobs.map((job) => (
              <article key={job.id} className="list-card">
                <div className="list-card-header">
                  <strong>{job.status}</strong>
                  <span className={`status-pill ${job.status === "success" ? "status-success" : job.status === "failed" ? "status-error" : "status-muted"}`}>
                    {job.trigger_type}
                  </span>
                </div>
                <p className="subtle">{job.started_at ? new Date(job.started_at).toLocaleString() : "Not started yet"}</p>
                <p className="subtle">{JSON.stringify(job.summary)}</p>
                {job.error_message ? <div className="error-box">{job.error_message}</div> : null}
              </article>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Audit / events">
          <div className="stack">
            {logs?.audit_logs.slice(0, 10).map((entry) => (
              <article key={entry.id} className="list-card compact-card">
                <strong>{entry.action}</strong>
                <p className="subtle">
                  {entry.entity_type} · {new Date(entry.created_at).toLocaleString()}
                </p>
              </article>
            ))}
            {logs?.job_events.slice(0, 10).map((entry) => (
              <article key={entry.id} className="list-card compact-card">
                <strong>{entry.level}</strong>
                <p className="subtle">{entry.message}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
