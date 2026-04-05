import { ConfirmDialog } from "../components/ConfirmDialog";
import { QueryStatePanel } from "../components/QueryStatePanel";
import { SectionCard } from "../components/SectionCard";
import { SourceForm } from "../features/sources/SourceForm";
import { useSourcesPage } from "../features/sources/useSourcesPage";

export function SourcesPage() {
  const {
    appSettings,
    appSettingsQuery,
    deleteMutation,
    discoverMutation,
    editing,
    oauthMutation,
    pendingDelete,
    setEditing,
    setPendingDelete,
    sources,
    sourcesQuery,
    startSync,
    submitSource,
    syncFeedback,
    syncingSourceId,
    testMutation,
  } = useSourcesPage();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Source management</span>
          <h2>Connect and synchronize contact sources</h2>
        </div>
      </header>
      <div className="two-column two-column-wide">
        <SectionCard
          title={editing ? "Edit source" : "New source"}
          actions={editing ? <button className="ghost-button" onClick={() => setEditing(undefined)}>New</button> : null}
        >
          {appSettingsQuery.isPending ? (
            <QueryStatePanel
              message="Loading default source settings and saved preferences."
              title="Preparing source form"
              tone="loading"
            />
          ) : appSettingsQuery.error ? (
            <QueryStatePanel
              message={(appSettingsQuery.error as Error).message}
              title="Could not load source defaults"
              tone="error"
            />
          ) : (
            <SourceForm
              source={editing}
              defaults={appSettings}
              submitLabel={editing ? "Update source" : "Create source"}
              onSubmit={submitSource}
            />
          )}
        </SectionCard>
        <SectionCard title="Configured sources">
          <div className="callout source-progress-callout">
            `Test connection` only verifies connectivity. `Start sync` is what actually imports contacts. During a sync, the status is shown directly on the source card.
          </div>
          <div className="stack">
            {sourcesQuery.isPending ? (
              <QueryStatePanel
                message="Loading configured sources, status, and last sync details."
                title="Loading sources"
                tone="loading"
              />
            ) : sourcesQuery.error ? (
              <QueryStatePanel
                message={(sourcesQuery.error as Error).message}
                title="Could not load sources"
                tone="error"
              />
            ) : sources.length ? (
              sources.map((source) => (
                <article key={source.id} className="list-card">
                  <div className="list-card-header">
                    <div>
                      <strong>{source.name}</strong>
                      <p>{source.type}</p>
                    </div>
                    <span className={`status-pill ${source.is_active ? "status-success" : "status-muted"}`}>
                      {source.is_active ? "active" : "inactive"}
                    </span>
                  </div>
                  <p className="subtle">{source.notes || "No notes."}</p>
                  <p className="subtle">
                    Last sync: {source.last_successful_sync_at ? new Date(source.last_successful_sync_at).toLocaleString() : "never"}
                  </p>
                  <p className="subtle">
                    Merge strategy:{" "}
                    {source.credential_summary.merge_strategy === "mirror_source"
                      ? "Mirror source and delete locally removed contacts"
                      : "Import and update only, never delete locally"}
                  </p>
                  {syncingSourceId === source.id ? (
                    <div className="sync-progress-box">
                      <span className="sync-spinner" aria-hidden="true" />
                      <span>Sync running. Contacts are being loaded and then stored.</span>
                    </div>
                  ) : null}
                  {syncFeedback[source.id] ? (
                    <div className={syncFeedback[source.id].tone === "error" ? "error-box" : "info-box"}>
                      {syncFeedback[source.id].message}
                    </div>
                  ) : null}
                  {source.last_error ? <div className="error-box">{source.last_error}</div> : null}
                  <div className="button-row">
                    <button className="ghost-button" onClick={() => setEditing(source)}>Edit</button>
                    <button className="ghost-button" onClick={() => testMutation.mutate(source.id)}>Test connection</button>
                    {source.type !== "google" ? (
                      <button className="ghost-button" onClick={() => discoverMutation.mutate(source.id)}>Load address books</button>
                    ) : null}
                    <button
                      className="ghost-button"
                      disabled={syncingSourceId === source.id}
                      onClick={() => startSync(source)}
                    >
                      {syncingSourceId === source.id ? "Sync running..." : "Start sync"}
                    </button>
                    {source.type === "google" ? (
                      <button className="ghost-button" onClick={() => oauthMutation.mutate(source.id)}>Google OAuth</button>
                    ) : null}
                    <button className="danger-button" onClick={() => setPendingDelete(source)}>
                      Delete
                    </button>
                  </div>
                  {source.addressbooks.length ? (
                    <div className="chip-row">
                      {source.addressbooks.map((book) => (
                        <span key={book.href} className={`chip ${book.is_selected ? "chip-active" : ""}`}>
                          {book.display_name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <QueryStatePanel
                message="Create your first source to start testing connections and importing contacts."
                title="No sources configured yet"
              />
            )}
          </div>
        </SectionCard>
      </div>
      <ConfirmDialog
        confirmLabel="Delete source"
        isConfirming={deleteMutation.isPending}
        message={
          pendingDelete
            ? `Delete ${pendingDelete.name}? This removes its local contacts, jobs history references, and stored source settings.`
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Delete source"
        tone="danger"
      />
    </div>
  );
}
