import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import type { AppSettings, ExportProfile, ExportProfilePayload } from "../../types/api";
import {
  buildExportProfilePayload,
  getProfileFormDefaults,
  profileSchema,
  type ProfileFormInput,
  type ProfileFormValues,
} from "./formState";

export function ExportProfileForm({
  profile,
  defaults,
  sourceIds,
  onSubmit,
}: {
  profile?: ExportProfile;
  defaults?: AppSettings;
  sourceIds: string[];
  onSubmit: (payload: ExportProfilePayload) => void;
}) {
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: getProfileFormDefaults(profile, defaults),
  });
  const {
    formState: { errors },
  } = form;

  useEffect(() => {
    form.reset(getProfileFormDefaults(profile, defaults));
  }, [defaults, form, profile]);

  return (
    <form
      className="form-grid"
      noValidate
      onSubmit={form.handleSubmit((values) => onSubmit(buildExportProfilePayload(values, sourceIds)))}
    >
      <label>
        <span>Name</span>
        <span className="field-help">Internal display name of the export profile in this app and in the XML preview.</span>
        <input
          {...form.register("name")}
          aria-invalid={Boolean(errors.name)}
          className={errors.name ? "input-invalid" : undefined}
          placeholder="Default"
        />
        {errors.name ? <span className="field-error">{errors.name.message}</span> : null}
      </label>
      <label>
        <span>Slug</span>
        <span className="field-help">URL segment of the phonebook. For example, `test-team` becomes `/api/yealink/phonebook/test-team.xml`.</span>
        <input
          {...form.register("slug")}
          aria-invalid={Boolean(errors.slug)}
          className={errors.slug ? "input-invalid" : undefined}
          placeholder="default"
        />
        {errors.slug ? <span className="field-error">{errors.slug.message}</span> : null}
      </label>
      <label className="checkbox-row">
        <input type="checkbox" {...form.register("is_active")} />
        <span>Profile active</span>
      </label>
      <label>
        <span>Sort order</span>
        <span className="field-help">Lower values appear earlier in lists and overview pages.</span>
        <input
          type="number"
          {...form.register("sort_order")}
          aria-invalid={Boolean(errors.sort_order)}
          className={errors.sort_order ? "input-invalid" : undefined}
        />
        {errors.sort_order ? <span className="field-error">{errors.sort_order.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Description</span>
        <span className="field-help">Short note describing the purpose of this profile, for example team, private, or support.</span>
        <textarea
          {...form.register("description")}
          aria-invalid={Boolean(errors.description)}
          className={errors.description ? "input-invalid" : undefined}
          rows={2}
        />
        {errors.description ? <span className="field-error">{errors.description.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Name expression</span>
        <span className="field-help">Determines the name in the Yealink XML. Placeholders such as <code>{"{full_name}"}</code> and fallbacks with <code>??</code> are supported.</span>
        <input
          {...form.register("expression")}
          aria-invalid={Boolean(errors.expression)}
          className={errors.expression ? "input-invalid" : undefined}
          placeholder="{organization} ?? {full_name} ?? primary_phone"
        />
        {errors.expression ? <span className="field-error">{errors.expression.message}</span> : null}
      </label>
      <label>
        <span>Prefix</span>
        <span className="field-help">Added before every generated display name.</span>
        <input
          {...form.register("prefix")}
          aria-invalid={Boolean(errors.prefix)}
          className={errors.prefix ? "input-invalid" : undefined}
          placeholder="VIP - "
        />
        {errors.prefix ? <span className="field-error">{errors.prefix.message}</span> : null}
      </label>
      <label>
        <span>Suffix</span>
        <span className="field-help">Added after every generated display name.</span>
        <input
          {...form.register("suffix")}
          aria-invalid={Boolean(errors.suffix)}
          className={errors.suffix ? "input-invalid" : undefined}
          placeholder=" (HQ)"
        />
        {errors.suffix ? <span className="field-error">{errors.suffix.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Group filter</span>
        <span className="field-help">Only contacts in these groups are exported. Empty means no group restriction.</span>
        <input
          {...form.register("include_groups")}
          aria-invalid={Boolean(errors.include_groups)}
          className={errors.include_groups ? "input-invalid" : undefined}
          placeholder="team, private"
        />
        {errors.include_groups ? <span className="field-error">{errors.include_groups.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Search filter</span>
        <span className="field-help">Additional text filter over name, organization, and notes. `,` or `OR` mean alternatives, `AND` is required, and `NOT` excludes terms.</span>
        <input
          {...form.register("search_query")}
          aria-invalid={Boolean(errors.search_query)}
          className={errors.search_query ? "input-invalid" : undefined}
          placeholder={'e.g. sales, support OR "inside sales" NOT internal'}
        />
        {errors.search_query ? <span className="field-error">{errors.search_query.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Allowed phone types</span>
        <span className="field-help">Only these types are eligible for export, for example `mobile`, `work`, or `main`.</span>
        <input
          {...form.register("allowed_types")}
          aria-invalid={Boolean(errors.allowed_types)}
          className={errors.allowed_types ? "input-invalid" : undefined}
          placeholder="mobile,work,main"
        />
        {errors.allowed_types ? <span className="field-error">{errors.allowed_types.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Excluded phone types</span>
        <span className="field-help">These types are always discarded, even if they would otherwise be allowed.</span>
        <input
          {...form.register("excluded_types")}
          aria-invalid={Boolean(errors.excluded_types)}
          className={errors.excluded_types ? "input-invalid" : undefined}
          placeholder="fax"
        />
        {errors.excluded_types ? <span className="field-error">{errors.excluded_types.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Priority order</span>
        <span className="field-help">Determines which number is chosen first when a contact has multiple matching numbers.</span>
        <input
          {...form.register("priority_order")}
          aria-invalid={Boolean(errors.priority_order)}
          className={errors.priority_order ? "input-invalid" : undefined}
          placeholder="mobile,work,main,home"
        />
        {errors.priority_order ? <span className="field-error">{errors.priority_order.message}</span> : null}
      </label>
      <label>
        <span>Max numbers per contact</span>
        <span className="field-help">Limits how many numbers per contact are written to the Yealink phonebook.</span>
        <input
          type="number"
          {...form.register("max_numbers_per_contact")}
          aria-invalid={Boolean(errors.max_numbers_per_contact)}
          className={errors.max_numbers_per_contact ? "input-invalid" : undefined}
        />
        {errors.max_numbers_per_contact ? (
          <span className="field-error">{errors.max_numbers_per_contact.message}</span>
        ) : null}
      </label>
      <button type="submit" className="primary-button">
        Save profile
      </button>
    </form>
  );
}
