import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { SourceForm } from "../features/sources/SourceForm";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import type { Source, SourceCreatePayload } from "../types/api";

export function SourcesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Source | undefined>();
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<Record<string, string>>({});
  const { data: sources = [] } = useQuery({ queryKey: ["sources"], queryFn: api.getSources });
  const { data: appSettings } = useQuery({ queryKey: ["app-settings"], queryFn: api.getAppSettings });

  const createMutation = useMutation({
    mutationFn: api.createSource,
    onSuccess: (source) => {
      toast.push("success", "Source saved.");
      setEditing(source);
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SourceCreatePayload> }) =>
      api.updateSource(id, payload),
    onSuccess: (source) => {
      toast.push("success", "Source updated.");
      setEditing(source);
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const testMutation = useMutation({
    mutationFn: api.testSource,
    onSuccess: (result) =>
      toast.push(
        result.ok ? "success" : "error",
        result.ok ? `${result.message} No contacts are imported during a connection test. Use "Start sync" afterwards.` : result.message,
      ),
  });

  const syncMutation = useMutation({
    mutationFn: api.syncSource,
    onSuccess: (result) => {
      const imported = typeof result.summary.imported_contacts === "number" ? result.summary.imported_contacts : null;
      const deleted = typeof result.summary.deleted_contacts === "number" ? result.summary.deleted_contacts : 0;
      setSyncFeedback((current) => ({
        ...current,
        [result.source_id ?? "unknown"]:
          result.status === "success"
            ? imported !== null
              ? deleted > 0
                ? `${imported} contacts imported or updated, ${deleted} removed locally. The contact list is refreshing now.`
                : `${imported} contacts imported or updated. The contact list is refreshing now.`
              : "Sync completed successfully. The contact list is refreshing now."
            : "Sync failed.",
      }));
      toast.push(
        result.status === "success" ? "success" : "error",
        result.status === "success"
          ? imported !== null
            ? deleted > 0
              ? `Sync finished: ${imported} contacts imported or updated, ${deleted} removed locally.`
              : `Sync finished: ${imported} contacts imported or updated.`
            : "Sync finished."
          : `Sync finished: ${result.status}`,
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sources"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
      ]);
    },
    onError: (error: Error) => toast.push("error", error.message),
    onSettled: () => setSyncingSourceId(null),
  });

  const discoverMutation = useMutation({
    mutationFn: api.discoverAddressbooks,
    onSuccess: async (result, sourceId) => {
      const source = sources.find((item) => item.id === sourceId);
      if (!source) {
        return;
      }
      await api.updateSource(source.id, {
        addressbooks: result.addressbooks.map((book, index) => ({
          ...book,
          is_selected: source.addressbooks.find((item) => item.href === book.href)?.is_selected ?? index === 0,
        })),
      });
      toast.push("success", `${result.addressbooks.length} address book(s) stored.`);
      await queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSource,
    onSuccess: () => {
      toast.push("success", "Source deleted.");
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const oauthMutation = useMutation({
    mutationFn: api.startGoogleOAuth,
    onSuccess: ({ authorization_url }) => {
      window.open(authorization_url, "_blank", "noopener,noreferrer");
      toast.push("info", "Started Google OAuth in a new tab.");
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Source management</span>
          <h2>Connect and synchronize contact sources</h2>
        </div>
      </header>
      <div className="two-column two-column-wide">
        <SectionCard title={editing ? "Edit source" : "New source"} actions={editing ? <button className="ghost-button" onClick={() => setEditing(undefined)}>New</button> : null}>
          <SourceForm
            source={editing}
            defaults={appSettings}
            submitLabel={editing ? "Update source" : "Create source"}
            onSubmit={(payload) => {
              if (editing) {
                updateMutation.mutate({ id: editing.id, payload });
              } else {
                createMutation.mutate(payload);
              }
            }}
          />
        </SectionCard>
        <SectionCard title="Configured sources">
          <div className="callout source-progress-callout">
            `Test connection` only verifies connectivity. `Start sync` is what actually imports contacts. During a sync, the status is shown directly on the source card.
          </div>
          <div className="stack">
            {sources.map((source) => (
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
                {syncFeedback[source.id] ? <div className="info-box">{syncFeedback[source.id]}</div> : null}
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
                    onClick={() => {
                      setSyncingSourceId(source.id);
                      setSyncFeedback((current) => ({
                        ...current,
                        [source.id]: "Sync started. This may take a moment depending on source size and contact count.",
                      }));
                      syncMutation.mutate(source.id);
                    }}
                  >
                    {syncingSourceId === source.id ? "Sync running..." : "Start sync"}
                  </button>
                  {source.type === "google" ? (
                    <button className="ghost-button" onClick={() => oauthMutation.mutate(source.id)}>Google OAuth</button>
                  ) : null}
                  <button
                    className="danger-button"
                    onClick={() => {
                      if (window.confirm(`Delete source ${source.name}?`)) {
                        deleteMutation.mutate(source.id);
                      }
                    }}
                  >
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
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
