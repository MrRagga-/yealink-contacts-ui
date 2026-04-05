import { useQuery } from "@tanstack/react-query";

import { QueryStatePanel } from "../components/QueryStatePanel";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

function renderSummary(summary: Record<string, unknown>) {
  const entries = Object.entries(summary);
  if (!entries.length) {
    return <p className="subtle">No summary details recorded for this job.</p>;
  }

  return (
    <dl className="summary-list">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{key.replaceAll("_", " ")}</dt>
          <dd>{typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JobsPage() {
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: api.getJobs });
  const logsQuery = useQuery({ queryKey: ["logs"], queryFn: api.getLogs });
  const jobs = jobsQuery.data ?? [];
  const logs = logsQuery.data;

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
            {jobsQuery.isPending ? (
              <QueryStatePanel
                message="Loading sync history and job summaries."
                title="Loading jobs"
                tone="loading"
              />
            ) : jobsQuery.error ? (
              <QueryStatePanel
                message={(jobsQuery.error as Error).message}
                title="Could not load jobs"
                tone="error"
              />
            ) : jobs.length ? (
              jobs.map((job) => (
                <article key={job.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{job.status}</strong>
                    <span className={`status-pill ${job.status === "success" ? "status-success" : job.status === "failed" ? "status-error" : "status-muted"}`}>
                      {job.trigger_type}
                    </span>
                  </div>
                  <p className="subtle">{job.started_at ? new Date(job.started_at).toLocaleString() : "Not started yet"}</p>
                  {renderSummary(job.summary)}
                  {job.error_message ? <div className="error-box">{job.error_message}</div> : null}
                </article>
              ))
            ) : (
              <QueryStatePanel message="Run a sync to create the first job entry." title="No jobs yet" />
            )}
          </div>
        </SectionCard>
        <SectionCard title="Audit / events">
          <div className="stack">
            {logsQuery.isPending ? (
              <QueryStatePanel
                message="Loading recent audit entries and job events."
                title="Loading logs"
                tone="loading"
              />
            ) : logsQuery.error ? (
              <QueryStatePanel
                message={(logsQuery.error as Error).message}
                title="Could not load logs"
                tone="error"
              />
            ) : logs && (logs.audit_logs.length || logs.job_events.length) ? (
              <>
                {logs.audit_logs.slice(0, 10).map((entry) => (
                  <article key={entry.id} className="list-card compact-card">
                    <strong>{entry.action}</strong>
                    <p className="subtle">
                      {entry.entity_type} · {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </article>
                ))}
                {logs.job_events.slice(0, 10).map((entry) => (
                  <article key={entry.id} className="list-card compact-card">
                    <strong>{entry.level}</strong>
                    <p className="subtle">{entry.message}</p>
                  </article>
                ))}
              </>
            ) : (
              <QueryStatePanel message="Audit and job event history will appear after the first admin action or sync." title="No logs yet" />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
