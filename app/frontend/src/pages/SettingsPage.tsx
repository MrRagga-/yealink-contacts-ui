import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { SectionCard } from "../components/SectionCard";
import { PasskeyList } from "../features/settings/PasskeyList";
import {
  buildSettingsPayload,
  getSettingsFormValues,
  settingsSchema,
  type SettingsFormInput,
  type SettingsFormValues,
} from "../features/settings/formState";
import { useSettingsPage } from "../features/settings/useSettingsPage";
import { useI18n } from "../lib/i18n";

export function SettingsPage() {
  const { t } = useI18n();
  const {
    deletePasskeyMutation,
    passkeyLabel,
    passkeys,
    registerPasskeyMutation,
    setPasskeyLabel,
    settings,
    updateMutation,
    user,
  } = useSettingsPage();
  const form = useForm<SettingsFormInput, unknown, SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: getSettingsFormValues(),
  });
  const {
    formState: { errors },
  } = form;

  useEffect(() => {
    form.reset(getSettingsFormValues(settings));
  }, [form, settings]);

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
          noValidate
          onSubmit={form.handleSubmit((values) => updateMutation.mutate(buildSettingsPayload(values)))}
        >
          {Object.keys(errors).length ? (
            <div className="error-box full-span" role="alert">
              Please fix the highlighted settings fields before saving.
            </div>
          ) : null}
          <label className="full-span">
            <span>Default source type</span>
            <span className="field-help">This source type is preselected when you create a new source.</span>
            <select
              {...form.register("default_new_source_type")}
              aria-invalid={Boolean(errors.default_new_source_type)}
              className={errors.default_new_source_type ? "input-invalid" : undefined}
            >
              <option value="carddav">CardDAV</option>
              <option value="nextcloud_carddav">Nextcloud Contacts</option>
              <option value="google">Google Contacts</option>
            </select>
            {errors.default_new_source_type ? (
              <span className="field-error">{errors.default_new_source_type.message}</span>
            ) : null}
          </label>
          <label className="full-span">
            <span>Default merge strategy for new sources</span>
            <span className="field-help">
              Controls whether new sources only import and update contacts or mirror the source including deletions.
            </span>
            <select
              {...form.register("default_new_source_merge_strategy")}
              aria-invalid={Boolean(errors.default_new_source_merge_strategy)}
              className={errors.default_new_source_merge_strategy ? "input-invalid" : undefined}
            >
              <option value="upsert_only">Import and update only, never delete locally</option>
              <option value="mirror_source">Mirror source and delete locally removed contacts</option>
            </select>
            {errors.default_new_source_merge_strategy ? (
              <span className="field-error">{errors.default_new_source_merge_strategy.message}</span>
            ) : null}
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
            <input
              type="number"
              {...form.register("default_profile_max_numbers_per_contact")}
              aria-invalid={Boolean(errors.default_profile_max_numbers_per_contact)}
              className={errors.default_profile_max_numbers_per_contact ? "input-invalid" : undefined}
            />
            {errors.default_profile_max_numbers_per_contact ? (
              <span className="field-error">{errors.default_profile_max_numbers_per_contact.message}</span>
            ) : null}
          </label>
          <label className="full-span">
            <span>Default name expression</span>
            <span className="field-help">Template for the Yealink display name on newly created export profiles.</span>
            <input
              {...form.register("default_profile_name_expression")}
              aria-invalid={Boolean(errors.default_profile_name_expression)}
              className={errors.default_profile_name_expression ? "input-invalid" : undefined}
              placeholder="{full_name}"
            />
            {errors.default_profile_name_expression ? (
              <span className="field-error">{errors.default_profile_name_expression.message}</span>
            ) : null}
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
          <label className="checkbox-row full-span">
            <input type="checkbox" {...form.register("debug_enabled")} />
            <span>
              <strong>Enable debug logging</strong>
              <span className="field-help">
                Logs the incoming peer IP, forwarded IP headers, resolved client IP, and CIDR matches during access checks.
              </span>
            </span>
          </label>
          <label className="full-span">
            <span>Admin allowed CIDRs</span>
            <span className="field-help">Only these IP ranges can reach the admin SPA and admin APIs. One CIDR per line.</span>
            <textarea
              rows={4}
              {...form.register("admin_allowed_cidrs")}
              aria-invalid={Boolean(errors.admin_allowed_cidrs)}
              className={errors.admin_allowed_cidrs ? "input-invalid" : undefined}
            />
            {errors.admin_allowed_cidrs ? <span className="field-error">{errors.admin_allowed_cidrs.message}</span> : null}
          </label>
          <label className="full-span">
            <span>Yealink XML allowed CIDRs</span>
            <span className="field-help">Only these IP ranges can fetch the public phonebook XML endpoint. One CIDR per line.</span>
            <textarea
              rows={4}
              {...form.register("xml_allowed_cidrs")}
              aria-invalid={Boolean(errors.xml_allowed_cidrs)}
              className={errors.xml_allowed_cidrs ? "input-invalid" : undefined}
            />
            {errors.xml_allowed_cidrs ? <span className="field-error">{errors.xml_allowed_cidrs.message}</span> : null}
          </label>
          <button type="submit" className="primary-button">
            Save settings
          </button>
        </form>
        <div className="info-box">
          If admin CIDR checks reject a LAN client unexpectedly behind a proxy, enable debug logging and compare the logged
          `peer_host`, `x_forwarded_for`, and `resolved_client_ip`. In Docker or Nginx setups you may also need
          `TRUSTED_PROXY_CIDRS` so the backend trusts the proxy hop.
        </div>
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
