import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "../components/DataTable";
import { SectionCard } from "../components/SectionCard";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import type { Contact } from "../types/api";

const columnHelper = createColumnHelper<Contact>();

export function ContactsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["contacts", search],
    queryFn: () => api.getContacts(search),
  });
  const { data: selectedContact } = useQuery({
    queryKey: ["contact", selectedContactId],
    queryFn: () => api.getContact(selectedContactId as string),
    enabled: Boolean(selectedContactId),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteContact,
    onSuccess: async () => {
      toast.push("success", "Contact deleted.");
      setSelectedContactId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["contact"] }),
        queryClient.invalidateQueries({ queryKey: ["exports"] }),
        queryClient.invalidateQueries({ queryKey: ["preview"] }),
      ]);
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const columns = useMemo<ColumnDef<Contact, any>[]>(
    () => [
      columnHelper.accessor("full_name", { header: "Name", cell: (info) => info.getValue() ?? "Unnamed" }),
      columnHelper.accessor("organization", { header: "Organization", cell: (info) => info.getValue() ?? "—" }),
      columnHelper.display({
        id: "groups",
        header: "Groups",
        cell: (info) => (
          <div className="chip-row">
            {info.row.original.groups.map((group) => (
              <span key={group} className="chip">
                {group}
              </span>
            ))}
          </div>
        ),
      }),
      columnHelper.display({
        id: "phones",
        header: "Numbers",
        cell: (info) => info.row.original.phone_numbers.map((phone) => phone.normalized_e164 || phone.value).join(", "),
      }),
      columnHelper.display({
        id: "duplicates",
        header: "Duplicates",
        cell: (info) => info.row.original.duplicate_hints.length || "—",
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <button className="ghost-button" onClick={() => setSelectedContactId(info.row.original.id)}>
            Details
          </button>
        ),
      }),
    ],
    [],
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Contact inventory</span>
          <h2>Normalized contacts and raw payload</h2>
        </div>
        <label className="search-field">
          <span>Search</span>
          <span className="field-help">Filters the contact list by name, organization, and notes. The filter applies directly to the loaded overview.</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, organization, note" />
        </label>
      </header>
      <SectionCard title={`Contacts (${data?.total ?? 0})`}>
        <DataTable columns={columns} data={data?.items ?? []} />
      </SectionCard>
      <SectionCard title="Raw payload detail view">
        {selectedContact ? (
          <div className="stack">
            <div>
              <strong>{selectedContact.full_name || "Unnamed"}</strong>
              <p className="subtle">
                {selectedContact.phone_numbers.map((phone) => `${phone.type}: ${phone.normalized_e164 || phone.value}`).join(" · ")}
              </p>
            </div>
            <div className="button-row">
              <button
                className="danger-button"
                onClick={() => {
                  if (window.confirm(`Delete contact ${selectedContact.full_name || selectedContact.id}?`)) {
                    deleteMutation.mutate(selectedContact.id);
                  }
                }}
              >
                Delete contact
              </button>
            </div>
            <p className="subtle">Shows the original source payload so you can verify mapping, normalization, and duplicate detection.</p>
            <textarea className="code-area" readOnly rows={16} value={JSON.stringify(selectedContact.raw_payload, null, 2)} />
          </div>
        ) : (
          <p className="subtle">Select a contact to inspect raw payload and normalized fields.</p>
        )}
      </SectionCard>
    </div>
  );
}
