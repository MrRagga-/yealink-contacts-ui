import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataTable } from "../components/DataTable";
import { QueryStatePanel } from "../components/QueryStatePanel";
import { SectionCard } from "../components/SectionCard";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import type { Contact } from "../types/api";

const columnHelper = createColumnHelper<Contact>();
const PAGE_SIZE = 25;

export function ContactsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(0);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const contactsQuery = useQuery({
    queryKey: ["contacts", debouncedSearch, page],
    queryFn: () => api.getContacts(debouncedSearch, undefined, { offset: page * PAGE_SIZE, limit: PAGE_SIZE }),
  });
  const selectedContactQuery = useQuery({
    queryKey: ["contact", selectedContactId],
    queryFn: () => api.getContact(selectedContactId as string),
    enabled: Boolean(selectedContactId),
  });
  const data = contactsQuery.data;
  const selectedContact = selectedContactQuery.data;
  const hasPreviousPage = page > 0;
  const hasNextPage = ((data?.offset ?? 0) + (data?.items.length ?? 0)) < (data?.total ?? 0);
  const deleteMutation = useMutation({
    mutationFn: api.deleteContact,
    onSuccess: async () => {
      toast.push("success", "Contact deleted.");
      setSelectedContactId(null);
      setPendingDelete(null);
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
          <span className="field-help">Filters the contact list by name, organization, and notes. Search is debounced before querying the backend.</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Name, organization, note"
          />
        </label>
      </header>
      <SectionCard title={`Contacts (${data?.total ?? 0})`}>
        {contactsQuery.isPending ? (
          <QueryStatePanel
            message="Loading normalized contacts, duplicate hints, and source data."
            title="Loading contacts"
            tone="loading"
          />
        ) : contactsQuery.error ? (
          <QueryStatePanel
            message={(contactsQuery.error as Error).message}
            title="Could not load contacts"
            tone="error"
          />
        ) : (
          <div className="stack">
            <DataTable
              caption="Normalized contact inventory"
              columns={columns}
              data={data?.items ?? []}
              emptyMessage={debouncedSearch ? "No contacts match the current search." : "No contacts have been imported yet."}
            />
            <div className="button-row pagination-row">
              <button className="ghost-button" disabled={!hasPreviousPage} onClick={() => setPage((current) => Math.max(current - 1, 0))}>
                Previous page
              </button>
              <span className="subtle">
                Showing {data?.items.length ?? 0} of {data?.total ?? 0} contact(s)
              </span>
              <button className="ghost-button" disabled={!hasNextPage} onClick={() => setPage((current) => current + 1)}>
                Next page
              </button>
            </div>
          </div>
        )}
      </SectionCard>
      <SectionCard title="Raw payload detail view">
        {selectedContactId && selectedContactQuery.isPending ? (
          <QueryStatePanel
            message="Loading the selected contact payload and normalized fields."
            title="Loading contact details"
            tone="loading"
          />
        ) : selectedContactQuery.error ? (
          <QueryStatePanel
            message={(selectedContactQuery.error as Error).message}
            title="Could not load contact details"
            tone="error"
          />
        ) : selectedContact ? (
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
                onClick={() => setPendingDelete(selectedContact)}
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
      <ConfirmDialog
        confirmLabel="Delete contact"
        isConfirming={deleteMutation.isPending}
        message={
          pendingDelete
            ? `Delete ${pendingDelete.full_name || pendingDelete.id}? This removes the local normalized record and updates export previews.`
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Delete contact"
        tone="danger"
      />
    </div>
  );
}
