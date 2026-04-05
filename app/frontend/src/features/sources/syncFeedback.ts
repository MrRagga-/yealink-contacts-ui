import type { SyncJob } from "../../types/api";

export type SourceSyncFeedback = {
  message: string;
  tone: "info" | "error";
};

export function buildPendingSyncFeedback(): SourceSyncFeedback {
  return {
    message: "Sync started. This may take a moment depending on source size and contact count.",
    tone: "info",
  };
}

export function buildSyncResultFeedback(result: SyncJob): SourceSyncFeedback {
  const imported = typeof result.summary.imported_contacts === "number" ? result.summary.imported_contacts : null;
  const deleted = typeof result.summary.deleted_contacts === "number" ? result.summary.deleted_contacts : 0;

  if (result.status === "pending") {
    return {
      message: "Sync queued. Follow progress in Jobs while the import runs in the background.",
      tone: "info",
    };
  }

  if (result.status === "running") {
    return {
      message: "Sync is running in the background. Follow progress in Jobs for live status.",
      tone: "info",
    };
  }

  if (result.status !== "success") {
    return { message: "Sync failed.", tone: "error" };
  }

  if (imported === null) {
    return {
      message: "Sync completed successfully. The contact list is refreshing now.",
      tone: "info",
    };
  }

  return {
    message:
      deleted > 0
        ? `${imported} contacts imported or updated, ${deleted} removed locally. The contact list is refreshing now.`
        : `${imported} contacts imported or updated. The contact list is refreshing now.`,
    tone: "info",
  };
}

export function buildSyncErrorFeedback(error: Error): SourceSyncFeedback {
  return {
    message: `Sync failed: ${error.message}`,
    tone: "error",
  };
}
