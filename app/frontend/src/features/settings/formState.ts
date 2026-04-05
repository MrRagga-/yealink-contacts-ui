import { z } from "zod";

import type { AppSettings, SourceMergeStrategy, SourceType } from "../../types/api";

export const settingsSchema = z.object({
  default_new_source_type: z.enum(["google", "carddav", "nextcloud_carddav"]),
  default_new_source_merge_strategy: z.enum(["upsert_only", "mirror_source"]),
  default_profile_allowed_types: z.string().default("mobile,work,main,home"),
  default_profile_excluded_types: z.string().default("fax"),
  default_profile_priority_order: z.string().default("mobile,work,main,home,other,custom"),
  default_profile_max_numbers_per_contact: z.coerce.number().int().min(1).max(3).default(2),
  default_profile_name_expression: z.string().default("{full_name}"),
  default_profile_prefix: z.string().default(""),
  default_profile_suffix: z.string().default(""),
  debug_enabled: z.boolean().default(false),
  admin_allowed_cidrs: z.string().default("0.0.0.0/0\n::/0"),
  xml_allowed_cidrs: z.string().default("0.0.0.0/0\n::/0"),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

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

export function getSettingsFormValues(settings?: AppSettings): SettingsFormValues {
  return {
    default_new_source_type: (settings?.default_new_source_type ?? "carddav") as SourceType,
    default_new_source_merge_strategy:
      (settings?.default_new_source_merge_strategy ?? "upsert_only") as SourceMergeStrategy,
    default_profile_allowed_types: toCsv(settings?.default_profile_allowed_types ?? ["mobile", "work", "main", "home"]),
    default_profile_excluded_types: toCsv(settings?.default_profile_excluded_types ?? ["fax"]),
    default_profile_priority_order: toCsv(
      settings?.default_profile_priority_order ?? ["mobile", "work", "main", "home", "other", "custom"],
    ),
    default_profile_max_numbers_per_contact: settings?.default_profile_max_numbers_per_contact ?? 2,
    default_profile_name_expression: settings?.default_profile_name_expression ?? "{full_name}",
    default_profile_prefix: settings?.default_profile_prefix ?? "",
    default_profile_suffix: settings?.default_profile_suffix ?? "",
    debug_enabled: settings?.debug_enabled ?? false,
    admin_allowed_cidrs: toCidrText(settings?.admin_allowed_cidrs ?? ["0.0.0.0/0", "::/0"]),
    xml_allowed_cidrs: toCidrText(settings?.xml_allowed_cidrs ?? ["0.0.0.0/0", "::/0"]),
  };
}

export function buildSettingsPayload(values: SettingsFormValues): Partial<AppSettings> {
  return {
    default_new_source_type: values.default_new_source_type,
    default_new_source_merge_strategy: values.default_new_source_merge_strategy,
    default_profile_allowed_types: splitCsv(values.default_profile_allowed_types),
    default_profile_excluded_types: splitCsv(values.default_profile_excluded_types),
    default_profile_priority_order: splitCsv(values.default_profile_priority_order),
    default_profile_max_numbers_per_contact: values.default_profile_max_numbers_per_contact,
    default_profile_name_expression: values.default_profile_name_expression,
    default_profile_prefix: values.default_profile_prefix,
    default_profile_suffix: values.default_profile_suffix,
    debug_enabled: values.debug_enabled,
    admin_allowed_cidrs: splitCidrs(values.admin_allowed_cidrs),
    xml_allowed_cidrs: splitCidrs(values.xml_allowed_cidrs),
  };
}
