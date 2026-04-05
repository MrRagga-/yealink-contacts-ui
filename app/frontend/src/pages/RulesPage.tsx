import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { ExportProfileForm } from "../features/exportProfiles/ExportProfileForm";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import type { ExportProfile, ExportProfilePayload } from "../types/api";

export function RulesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ExportProfile | undefined>();
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: api.getProfiles });
  const { data: sources = [] } = useQuery({ queryKey: ["sources"], queryFn: api.getSources });
  const { data: appSettings } = useQuery({ queryKey: ["app-settings"], queryFn: api.getAppSettings });

  const createMutation = useMutation({
    mutationFn: api.createProfile,
    onSuccess: (profile) => {
      toast.push("success", "Export profile saved.");
      setEditing(profile);
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExportProfilePayload }) =>
      api.updateProfile(id, payload),
    onSuccess: (profile) => {
      toast.push("success", "Export profile updated.");
      setEditing(profile);
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Rules engine</span>
          <h2>Export profiles and phone rules</h2>
        </div>
      </header>
      <div className="two-column two-column-wide">
        <SectionCard title={editing ? "Edit export profile" : "New export profile"}>
          <ExportProfileForm
            profile={editing}
            defaults={appSettings}
            sourceIds={sources.map((source) => source.id)}
            onSubmit={(payload) => {
              if (editing) {
                updateMutation.mutate({ id: editing.id, payload });
              } else {
                createMutation.mutate(payload);
              }
            }}
          />
        </SectionCard>
        <SectionCard title="Existing profiles">
          <div className="stack">
            {profiles.map((profile) => (
              <article key={profile.id} className="list-card">
                <div className="list-card-header">
                  <div>
                    <strong>{profile.name}</strong>
                    <p>{profile.slug}</p>
                  </div>
                  <span className="status-pill status-success">{profile.is_active ? "active" : "inactive"}</span>
                </div>
                <p className="subtle">{profile.description || "No description."}</p>
                <p className="subtle">
                  Template: <code>{profile.rule_set.name_template.expression}</code>
                </p>
                <p className="subtle">
                  Numbers: {profile.rule_set.phone_selection.allowed_types.join(", ")} | Priority: {profile.rule_set.phone_selection.priority_order.join(" > ")}
                </p>
                <div className="button-row">
                  <button className="ghost-button" onClick={() => setEditing(profile)}>Edit</button>
                  <a className="ghost-button link-button" href={profile.xml_url} target="_blank" rel="noreferrer">
                    Open XML
                  </a>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
