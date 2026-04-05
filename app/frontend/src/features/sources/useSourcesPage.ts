import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../hooks/useToast";
import { api } from "../../lib/api";
import type { Source, SourceCreatePayload, SourceUpdatePayload } from "../../types/api";
import {
  buildPendingSyncFeedback,
  buildSyncErrorFeedback,
  buildSyncResultFeedback,
  type SourceSyncFeedback,
} from "./syncFeedback";

export function useSourcesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Source | undefined>();
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<Record<string, SourceSyncFeedback>>({});
  const [pendingDelete, setPendingDelete] = useState<Source | null>(null);

  const sourcesQuery = useQuery({ queryKey: ["sources"], queryFn: api.getSources });
  const appSettingsQuery = useQuery({ queryKey: ["app-settings"], queryFn: api.getAppSettings });
  const sources = sourcesQuery.data ?? [];
  const appSettings = appSettingsQuery.data;

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
    mutationFn: ({ id, payload }: { id: string; payload: SourceUpdatePayload }) =>
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
      setSyncFeedback((current) => ({
        ...current,
        [result.source_id ?? "unknown"]: buildSyncResultFeedback(result),
      }));
      const imported = typeof result.summary.imported_contacts === "number" ? result.summary.imported_contacts : null;
      const deleted = typeof result.summary.deleted_contacts === "number" ? result.summary.deleted_contacts : 0;
      if (result.status === "pending") {
        toast.push("info", "Sync queued. Open Jobs to follow progress.");
      } else if (result.status === "running") {
        toast.push("info", "Sync is running in the background.");
      } else {
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
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sources"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
      ]);
    },
    onError: (error: Error, sourceId) => {
      setSyncFeedback((current) => ({
        ...current,
        [sourceId]: buildSyncErrorFeedback(error),
      }));
      toast.push("error", error.message);
    },
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
      setPendingDelete(null);
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

  function submitSource(payload: SourceCreatePayload) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
      return;
    }
    createMutation.mutate(payload);
  }

  function startSync(source: Source) {
    setSyncingSourceId(source.id);
    setSyncFeedback((current) => ({
      ...current,
      [source.id]: buildPendingSyncFeedback(),
    }));
    syncMutation.mutate(source.id);
  }

  return {
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
  };
}
