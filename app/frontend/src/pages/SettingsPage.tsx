import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { SectionCard } from "../components/SectionCard";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { AppSettings, SourceMergeStrategy, SourceType } from "../types/api";

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
  };
}

export function SettingsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["app-settings"], queryFn: api.getAppSettings });
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
          <button type="submit" className="primary-button">
            Save settings
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
