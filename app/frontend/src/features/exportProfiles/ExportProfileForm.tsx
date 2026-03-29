import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { AppSettings, ExportProfile } from "../../types/api";

const profileSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
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

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ExportProfileForm({
  profile,
  defaults,
  sourceIds,
  onSubmit,
}: {
  profile?: ExportProfile;
  defaults?: AppSettings;
  sourceIds: string[];
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
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
      max_numbers_per_contact: profile?.rule_set.phone_selection.max_numbers_per_contact ?? defaults?.default_profile_max_numbers_per_contact ?? 2,
      expression: profile?.rule_set.name_template.expression ?? defaults?.default_profile_name_expression ?? "{full_name}",
      prefix: profile?.rule_set.name_template.prefix ?? defaults?.default_profile_prefix ?? "",
      suffix: profile?.rule_set.name_template.suffix ?? defaults?.default_profile_suffix ?? "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        slug: profile.slug,
        description: profile.description ?? "",
        is_active: profile.is_active,
        sort_order: profile.sort_order,
        include_groups: profile.rule_set.filters.include_groups.join(", "),
        search_query: profile.rule_set.filters.search_query ?? "",
        allowed_types: profile.rule_set.phone_selection.allowed_types.join(", "),
        excluded_types: profile.rule_set.phone_selection.excluded_types.join(", "),
        priority_order: profile.rule_set.phone_selection.priority_order.join(", "),
        max_numbers_per_contact: profile.rule_set.phone_selection.max_numbers_per_contact,
        expression: profile.rule_set.name_template.expression,
        prefix: profile.rule_set.name_template.prefix,
        suffix: profile.rule_set.name_template.suffix,
      });
      return;
    }
    form.reset({
      name: "",
      slug: "",
      description: "",
      is_active: true,
      sort_order: 0,
      include_groups: "",
      search_query: "",
      allowed_types: (defaults?.default_profile_allowed_types ?? ["mobile", "work", "main", "home"]).join(","),
      excluded_types: (defaults?.default_profile_excluded_types ?? ["fax"]).join(","),
      priority_order: (defaults?.default_profile_priority_order ?? ["mobile", "work", "main", "home", "other", "custom"]).join(","),
      max_numbers_per_contact: defaults?.default_profile_max_numbers_per_contact ?? 2,
      expression: defaults?.default_profile_name_expression ?? "{full_name}",
      prefix: defaults?.default_profile_prefix ?? "",
      suffix: defaults?.default_profile_suffix ?? "",
    });
  }, [defaults, form, profile]);

  return (
    <form
      className="form-grid"
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
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
        })
      )}
    >
      <label>
        <span>Name</span>
        <span className="field-help">Internal display name of the export profile in this app and in the XML preview.</span>
        <input {...form.register("name")} placeholder="Default" />
      </label>
      <label>
        <span>Slug</span>
        <span className="field-help">URL segment of the phonebook. For example, `test-team` becomes `/api/yealink/phonebook/test-team.xml`.</span>
        <input {...form.register("slug")} placeholder="default" />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" {...form.register("is_active")} />
        <span>Profile active</span>
      </label>
      <label>
        <span>Sort order</span>
        <span className="field-help">Lower values appear earlier in lists and overview pages.</span>
        <input type="number" {...form.register("sort_order")} />
      </label>
      <label className="full-span">
        <span>Description</span>
        <span className="field-help">Short note describing the purpose of this profile, for example team, private, or support.</span>
        <textarea {...form.register("description")} rows={2} />
      </label>
      <label className="full-span">
        <span>Name expression</span>
        <span className="field-help">Determines the name in the Yealink XML. Placeholders such as <code>{"{full_name}"}</code> and fallbacks with <code>??</code> are supported.</span>
        <input {...form.register("expression")} placeholder="{organization} ?? {full_name} ?? primary_phone" />
      </label>
      <label>
        <span>Prefix</span>
        <span className="field-help">Added before every generated display name.</span>
        <input {...form.register("prefix")} placeholder="VIP - " />
      </label>
      <label>
        <span>Suffix</span>
        <span className="field-help">Added after every generated display name.</span>
        <input {...form.register("suffix")} placeholder=" (HQ)" />
      </label>
      <label className="full-span">
        <span>Group filter</span>
        <span className="field-help">Only contacts in these groups are exported. Empty means no group restriction.</span>
        <input {...form.register("include_groups")} placeholder="team, private" />
      </label>
      <label className="full-span">
        <span>Search filter</span>
        <span className="field-help">Additional text filter over name, organization, and notes. `,` or `OR` mean alternatives, `AND` is required, and `NOT` excludes terms.</span>
        <input {...form.register("search_query")} placeholder={'e.g. sales, support OR "inside sales" NOT internal'} />
      </label>
      <label className="full-span">
        <span>Allowed phone types</span>
        <span className="field-help">Only these types are eligible for export, for example `mobile`, `work`, or `main`.</span>
        <input {...form.register("allowed_types")} placeholder="mobile,work,main" />
      </label>
      <label className="full-span">
        <span>Excluded phone types</span>
        <span className="field-help">These types are always discarded, even if they would otherwise be allowed.</span>
        <input {...form.register("excluded_types")} placeholder="fax" />
      </label>
      <label className="full-span">
        <span>Priority order</span>
        <span className="field-help">Determines which number is chosen first when a contact has multiple matching numbers.</span>
        <input {...form.register("priority_order")} placeholder="mobile,work,main,home" />
      </label>
      <label>
        <span>Max numbers per contact</span>
        <span className="field-help">Limits how many numbers per contact are written to the Yealink phonebook.</span>
        <input type="number" {...form.register("max_numbers_per_contact")} />
      </label>
      <button type="submit" className="primary-button">
        Save profile
      </button>
    </form>
  );
}
