import { z } from "zod";

import type {
  AppSettings,
  ExportProfile,
  ExportProfilePayload,
} from "../../types/api";

export const profileSchema = z.object({
  name: z.string().min(2, "Enter a profile name with at least 2 characters."),
  slug: z.string().min(2, "Enter a profile slug with at least 2 characters."),
  description: z.string().optional(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().default(0),
  include_groups: z.string().default(""),
  search_query: z.string().optional(),
  allowed_types: z.string().default("mobile,work,main,home"),
  excluded_types: z.string().default("fax"),
  priority_order: z.string().default("mobile,work,main,home,other,custom"),
  max_numbers_per_contact: z.coerce.number().int().min(1).max(3).default(1),
  expression: z.string().default("{full_name}"),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function getProfileFormDefaults(
  profile?: ExportProfile,
  defaults?: AppSettings,
): ProfileFormValues {
  return {
    name: profile?.name ?? "",
    slug: profile?.slug ?? "",
    description: profile?.description ?? "",
    is_active: profile?.is_active ?? true,
    sort_order: profile?.sort_order ?? 0,
    include_groups: profile ? profile.rule_set.filters.include_groups.join(", ") : "",
    search_query: profile?.rule_set.filters.search_query ?? "",
    allowed_types: profile
      ? profile.rule_set.phone_selection.allowed_types.join(", ")
      : (defaults?.default_profile_allowed_types ?? ["mobile", "work", "main", "home"]).join(","),
    excluded_types: profile
      ? profile.rule_set.phone_selection.excluded_types.join(", ")
      : (defaults?.default_profile_excluded_types ?? ["fax"]).join(","),
    priority_order: profile
      ? profile.rule_set.phone_selection.priority_order.join(", ")
      : (defaults?.default_profile_priority_order ?? ["mobile", "work", "main", "home", "other", "custom"]).join(","),
    max_numbers_per_contact:
      profile?.rule_set.phone_selection.max_numbers_per_contact
      ?? defaults?.default_profile_max_numbers_per_contact
      ?? 2,
    expression: profile?.rule_set.name_template.expression ?? defaults?.default_profile_name_expression ?? "{full_name}",
    prefix: profile?.rule_set.name_template.prefix ?? defaults?.default_profile_prefix ?? "",
    suffix: profile?.rule_set.name_template.suffix ?? defaults?.default_profile_suffix ?? "",
  };
}

export function buildExportProfilePayload(
  values: ProfileFormValues,
  sourceIds: string[],
): ExportProfilePayload {
  return {
    name: values.name,
    slug: values.slug,
    description: values.description,
    is_active: values.is_active,
    sort_order: values.sort_order,
    metadata: {},
    rule_set: {
      filters: {
        include_source_ids: sourceIds,
        exclude_source_ids: [],
        include_groups: values.include_groups
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        search_query: values.search_query || null,
        blacklist_contact_ids: [],
        blacklist_numbers: [],
        require_phone: true,
      },
      phone_selection: {
        allowed_types: values.allowed_types.split(",").map((item) => item.trim()).filter(Boolean),
        excluded_types: values.excluded_types.split(",").map((item) => item.trim()).filter(Boolean),
        priority_order: values.priority_order.split(",").map((item) => item.trim()).filter(Boolean),
        require_phone: true,
        max_numbers_per_contact: values.max_numbers_per_contact,
        normalize_to_e164: true,
      },
      name_template: {
        expression: values.expression,
        prefix: values.prefix,
        suffix: values.suffix,
        normalize_whitespace: true,
      },
    },
  };
}
