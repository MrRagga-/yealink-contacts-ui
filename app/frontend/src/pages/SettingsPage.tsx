import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startRegistration } from "@simplewebauthn/browser";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";

import { SectionCard } from "../components/SectionCard";
import { useAuth } from "../features/auth/AuthProvider";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { AppSettings, PasskeyCredential, SourceMergeStrategy, SourceType } from "../types/api";

const settingsSchema = z.object({
  default_new_source_type: z.enum(["google", "carddav", "nextcloud_carddav"]),
  default_new_source_merge_strategy: z.enum(["upsert_only", "mirror_source"]),
  default_profile_allowed_types: z.string().default("mobile,work,main,home"),
  default_profile_excluded_types: z.string().default("fax"),
  default_profile_priority_order: z.string().default("mobile,work,main,home,other,custom"),
  default_profile_max_numbers_per_contact: z.coerce.number().int().min(1).max(3).default(2),
  default_profile_name_expression: z.string().default("{full_name}"),
  default_profile_prefix: z.string().default(""),
  default_profile_suffix: z.string().default(""),
  admin_allowed_cidrs: z.string().default("0.0.0.0/0\n::/0"),
  xml_allowed_cidrs: z.string().default("0.0.0.0/0\n::/0"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function toCsv(values: string[]) {
  return values.join(",");
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCidrText(values: string[]) {
  return values.join("\n");
}

function splitCidrs(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toFormValues(settings?: AppSettings): SettingsFormValues {
  return {
    default_new_source_type: (settings?.default_new_source_type ?? "carddav") as SourceType,
    default_new_source_merge_strategy: (settings?.default_new_source_merge_strategy ?? "upsert_only") as SourceMergeStrategy,
    default_profile_allowed_types: toCsv(settings?.default_profile_allowed_types ?? ["mobile", "work", "main", "home"]),
    default_profile_excluded_types: toCsv(settings?.default_profile_excluded_types ?? ["fax"]),
    default_profile_priority_order: toCsv(
      settings?.default_profile_priority_order ?? ["mobile", "work", "main", "home", "other", "custom"],
    ),
    default_profile_max_numbers_per_contact: settings?.default_profile_max_numbers_per_contact ?? 2,
    default_profile_name_expression: settings?.default_profile_name_expression ?? "{full_name}",
    default_profile_prefix: settings?.default_profile_prefix ?? "",
    default_profile_suffix: settings?.default_profile_suffix ?? "",
    admin_allowed_cidrs: toCidrText(settings?.admin_allowed_cidrs ?? ["0.0.0.0/0", "::/0"]),
    xml_allowed_cidrs: toCidrText(settings?.xml_allowed_cidrs ?? ["0.0.0.0/0", "::/0"]),
  };
}

function PasskeyList({ passkeys, onDelete }: { passkeys: PasskeyCredential[]; onDelete: (id: string) => void }) {
  if (!passkeys.length) {
    return <div className="info-box">No passkeys registered yet.</div>;
  }

  return (
    <div className="stack">
      {passkeys.map((passkey) => (
        <article key={passkey.id} className="list-card compact-card">
          <div className="list-card-header">
            <div>
              <strong>{passkey.label}</strong>
              <p className="subtle">
                Added {new Date(passkey.created_at).toLocaleString()}
                {passkey.last_used_at ? ` • Last used ${new Date(passkey.last_used_at).toLocaleString()}` : ""}
              </p>
            </div>
            <button type="button" className="danger-button" onClick={() => onDelete(passkey.id)}>
              Remove
            </button>
          </div>
          <div className="chip-row">
            {passkey.transports.length ? (
              passkey.transports.map((transport) => (
                <span key={transport} className="chip">
                  {transport}
                </span>
              ))
            ) : (
              <span className="chip">transport not reported</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["app-settings"], queryFn: api.getAppSettings });
  const { data: passkeys = [] } = useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn: api.listPasskeys,
  });
  const [passkeyLabel, setPasskeyLabel] = useState("This device");
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormValues(),
  });

  useEffect(() => {
    form.reset(toFormValues(settings));
  }, [form, settings]);

  const updateMutation = useMutation({
    mutationFn: api.updateAppSettings,
    onSuccess: async () => {
      toast.push("success", "Settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const { options } = await api.getPasskeyRegistrationOptions({ label: passkeyLabel });
      const credential = await startRegistration({
        optionsJSON: options,
      });
      return api.verifyPasskeyRegistration({ credential });
    },
    onSuccess: async () => {
      toast.push("success", "Passkey added.");
      setPasskeyLabel("This device");
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: api.deletePasskey,
    onSuccess: async () => {
      toast.push("success", "Passkey removed.");
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("settingsEyebrow")}</span>
          <h2>{t("settingsTitle")}</h2>
        </div>
      </header>
      <SectionCard title={t("settingsSection")}>
        <form
          className="form-grid"
          onSubmit={form.handleSubmit((values) =>
            updateMutation.mutate({
              default_new_source_type: values.default_new_source_type,
              default_new_source_merge_strategy: values.default_new_source_merge_strategy,
              default_profile_allowed_types: splitCsv(values.default_profile_allowed_types),
              default_profile_excluded_types: splitCsv(values.default_profile_excluded_types),
              default_profile_priority_order: splitCsv(values.default_profile_priority_order),
              default_profile_max_numbers_per_contact: values.default_profile_max_numbers_per_contact,
              default_profile_name_expression: values.default_profile_name_expression,
              default_profile_prefix: values.default_profile_prefix,
              default_profile_suffix: values.default_profile_suffix,
              admin_allowed_cidrs: splitCidrs(values.admin_allowed_cidrs),
              xml_allowed_cidrs: splitCidrs(values.xml_allowed_cidrs),
            })
          )}
        >
          <label className="full-span">
            <span>Default source type</span>
            <span className="field-help">This source type is preselected when you create a new source.</span>
            <select {...form.register("default_new_source_type")}>
              <option value="carddav">CardDAV</option>
              <option value="nextcloud_carddav">Nextcloud Contacts</option>
              <option value="google">Google Contacts</option>
            </select>
          </label>
          <label className="full-span">
            <span>Default merge strategy for new sources</span>
            <span className="field-help">
              Controls whether new sources only import and update contacts or mirror the source including deletions.
            </span>
            <select {...form.register("default_new_source_merge_strategy")}>
              <option value="upsert_only">Import and update only, never delete locally</option>
              <option value="mirror_source">Mirror source and delete locally removed contacts</option>
            </select>
          </label>
          <label className="full-span">
            <span>Default allowed phone types</span>
            <span className="field-help">These types are automatically prefilled for new export profiles.</span>
            <input {...form.register("default_profile_allowed_types")} placeholder="mobile,work,main,home" />
          </label>
          <label className="full-span">
            <span>Default excluded phone types</span>
            <span className="field-help">Types in this list are excluded immediately for new profiles.</span>
            <input {...form.register("default_profile_excluded_types")} placeholder="fax" />
          </label>
          <label className="full-span">
            <span>Default priority order</span>
            <span className="field-help">Defines the order in which new profiles prefer matching numbers.</span>
            <input {...form.register("default_profile_priority_order")} placeholder="mobile,work,main,home,other,custom" />
          </label>
          <label>
            <span>Default max numbers per contact</span>
            <span className="field-help">New profiles inherit this value automatically. The current default is 2.</span>
            <input type="number" {...form.register("default_profile_max_numbers_per_contact")} />
          </label>
          <label className="full-span">
            <span>Default name expression</span>
            <span className="field-help">Template for the Yealink display name on newly created export profiles.</span>
            <input {...form.register("default_profile_name_expression")} placeholder="{full_name}" />
          </label>
          <label>
            <span>Default prefix</span>
            <span className="field-help">Added before every exported name in new profiles.</span>
            <input {...form.register("default_profile_prefix")} placeholder="VIP - " />
          </label>
          <label>
            <span>Default suffix</span>
            <span className="field-help">Added after every exported name in new profiles.</span>
            <input {...form.register("default_profile_suffix")} placeholder=" (HQ)" />
          </label>
          <label className="full-span">
            <span>Admin allowed CIDRs</span>
            <span className="field-help">Only these IP ranges can reach the admin SPA and admin APIs. One CIDR per line.</span>
            <textarea rows={4} {...form.register("admin_allowed_cidrs")} />
          </label>
          <label className="full-span">
            <span>Yealink XML allowed CIDRs</span>
            <span className="field-help">Only these IP ranges can fetch the public phonebook XML endpoint. One CIDR per line.</span>
            <textarea rows={4} {...form.register("xml_allowed_cidrs")} />
          </label>
          <button type="submit" className="primary-button">
            Save settings
          </button>
        </form>
      </SectionCard>
      <SectionCard title="Security">
        <div className="stack">
          <div className="info-box">
            Signed in as <strong>{user?.username}</strong>. Passkeys can be added after the bootstrap password has been replaced.
          </div>
          <label className="stack-label">
            <span>New passkey label</span>
            <span className="field-help">This label appears only in this admin UI and helps identify each registered device.</span>
            <input value={passkeyLabel} onChange={(event) => setPasskeyLabel(event.target.value)} placeholder="Office MacBook" />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => registerPasskeyMutation.mutate()}
              disabled={registerPasskeyMutation.isPending}
            >
              {registerPasskeyMutation.isPending ? "Waiting for passkey..." : "Add passkey"}
            </button>
          </div>
          <PasskeyList passkeys={passkeys} onDelete={(id) => deletePasskeyMutation.mutate(id)} />
        </div>
      </SectionCard>
    </div>
  );
}
