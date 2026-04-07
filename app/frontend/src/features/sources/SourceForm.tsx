import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import type { AppSettings, Source, SourceCreatePayload, SourceType } from "../../types/api";
import {
  buildSourcePayload,
  getSourceFormDefaults,
  sourceSchema,
  type SourceFormInput,
  type SourceFormValues,
} from "./formState";

const sourceInstructions: Record<
  SourceType,
  {
    title: string;
    intro: string;
    steps: ReactNode[];
    hints: ReactNode[];
  }
> = {
  google: {
    title: "Set up Google Contacts",
    intro: "For Google sources, OAuth client credentials are stored on the source itself. Connection is then established through the backend OAuth flow.",
    steps: [
      <>
        In the{" "}
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
          Google Cloud Console
        </a>{" "}
        create an OAuth client of type Web Application.
      </>,
      <>
        In the same Google Cloud project, enable the{" "}
        <a href="https://console.cloud.google.com/apis/library/people.googleapis.com" target="_blank" rel="noreferrer">
          People API
        </a>
        .
      </>,
      "Enter the client ID, client secret, and redirect URI on this source.",
      "Register the exact same redirect URI in Google so the callback returns to this app.",
      "Save the source in this UI, then click `Google OAuth` from the source list.",
      "In the Google consent window, grant Contacts Readonly access and then use `Start sync`.",
    ],
    hints: [
      "Without the correct redirect URI, the OAuth callback fails immediately.",
      "If test or sync fails with `SERVICE_DISABLED`, the People API is not enabled in the selected project yet.",
      "Client secret, refresh token, and access token stay in the backend only and are stored encrypted.",
    ],
  },
  carddav: {
    title: "Set up CardDAV",
    intro: "Generic CardDAV servers require a server URL, username, and password or app password.",
    steps: [
      "Enter the CardDAV base URL or address book URL of the server.",
      "Provide the username and password or app password.",
      "After saving, run `Test connection` first and then `Load address books`.",
      "Verify which loaded address books are selected, then run `Start sync`.",
    ],
    hints: [
      "If the server supports discovery, the home URL is usually enough instead of a direct VCF file.",
      "Example: `https://dav.example.com/addressbooks/users/jonas/`",
    ],
  },
  nextcloud_carddav: {
    title: "Set up Nextcloud Contacts",
    intro: "Nextcloud also uses CardDAV, but has common URL and auth conventions that are handled directly in this UI.",
    steps: [
      <>
        In{" "}
        <a href="https://docs.nextcloud.com/server/latest/user_manual/en/session_management.html#managing-devices" target="_blank" rel="noreferrer">
          Nextcloud
        </a>{" "}
        create an app password instead of using the normal account password.
      </>,
      "Use a server URL such as `https://<host>/remote.php/dav/addressbooks/users/<username>/`.",
      "Save the source, then run `Test connection` and `Load address books`.",
      "If successful, select the desired address book and then use `Start sync`.",
    ],
    hints: [
      "If the connection fails, the URL or app password is usually incorrect.",
      <>
        The discovery feature reads address books directly from the Nextcloud server via{" "}
        <a href="https://datatracker.ietf.org/doc/html/rfc6352" target="_blank" rel="noreferrer">
          CardDAV
        </a>
        .
      </>,
    ],
  },
};

function SourceInstructionPanel({ type }: { type: SourceType }) {
  const instruction = sourceInstructions[type];

  return (
    <div className="instruction-panel full-span">
      <div className="instruction-header">
        <span className="eyebrow">Setup note</span>
        <strong>{instruction.title}</strong>
      </div>
      <p className="instruction-intro">{instruction.intro}</p>
      <div className="instruction-grid">
        <div>
          <h3>Steps</h3>
          <ol className="instruction-list">
            {instruction.steps.map((step) => (
              <li key={typeof step === "string" ? step : `step-${instruction.title}-${instruction.steps.indexOf(step)}`}>{step}</li>
            ))}
          </ol>
        </div>
        <div>
          <h3>Important</h3>
          <ul className="instruction-list">
            {instruction.hints.map((hint) => (
              <li key={typeof hint === "string" ? hint : `hint-${instruction.title}-${instruction.hints.indexOf(hint)}`}>{hint}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SourceForm({
  source,
  defaults,
  onSubmit,
  submitLabel,
}: {
  source?: Source;
  defaults?: AppSettings;
  onSubmit: (payload: SourceCreatePayload) => void;
  submitLabel: string;
}) {
  const form = useForm<SourceFormInput, unknown, SourceFormValues>({
    resolver: zodResolver(sourceSchema),
    defaultValues: getSourceFormDefaults(source, defaults),
  });
  const {
    formState: { errors },
  } = form;

  const selectedType = form.watch("type");

  useEffect(() => {
    form.reset(getSourceFormDefaults(source, defaults));
  }, [defaults, form, source]);

  return (
    <form
      className="form-grid"
      noValidate
      onSubmit={form.handleSubmit((values) => onSubmit(buildSourcePayload(values, source)))}
    >
      <label>
        <span>Name</span>
        <span className="field-help">Display name of the source in the admin UI.</span>
        <input
          {...form.register("name")}
          aria-invalid={Boolean(errors.name)}
          className={errors.name ? "input-invalid" : undefined}
          placeholder="Company CardDAV"
        />
        {errors.name ? <span className="field-error">{errors.name.message}</span> : null}
      </label>
      <label>
        <span>Slug</span>
        <span className="field-help">Technical short name used in APIs and internal references.</span>
        <input
          {...form.register("slug")}
          aria-invalid={Boolean(errors.slug)}
          className={errors.slug ? "input-invalid" : undefined}
          placeholder="company-carddav"
        />
        {errors.slug ? <span className="field-error">{errors.slug.message}</span> : null}
      </label>
      <label>
        <span>Type</span>
        <span className="field-help">Determines which credentials and adapter implementation are used for this source.</span>
        <select
          {...form.register("type")}
          aria-invalid={Boolean(errors.type)}
          className={errors.type ? "input-invalid" : undefined}
        >
          <option value="google">Google Contacts</option>
          <option value="carddav">CardDAV</option>
          <option value="nextcloud_carddav">Nextcloud Contacts</option>
        </select>
        {errors.type ? <span className="field-error">{errors.type.message}</span> : null}
      </label>
      <label>
        <span>Merge strategy</span>
        <span className="field-help">
          Controls whether contacts missing in the source remain locally or are also deleted on the next successful sync.
        </span>
        <select
          {...form.register("merge_strategy")}
          aria-invalid={Boolean(errors.merge_strategy)}
          className={errors.merge_strategy ? "input-invalid" : undefined}
        >
          <option value="upsert_only">Import and update only, never delete locally</option>
          <option value="mirror_source">Mirror source and delete locally removed contacts</option>
        </select>
        {errors.merge_strategy ? <span className="field-error">{errors.merge_strategy.message}</span> : null}
      </label>
      <label className="checkbox-row">
        <input type="checkbox" {...form.register("is_active")} />
        <span>Source active</span>
      </label>
      <label className="full-span">
        <span>Tags</span>
        <span className="field-help">Comma-separated tags used later for filtering and documentation.</span>
        <input
          {...form.register("tags")}
          aria-invalid={Boolean(errors.tags)}
          className={errors.tags ? "input-invalid" : undefined}
          placeholder="private, team, priority"
        />
        {errors.tags ? <span className="field-error">{errors.tags.message}</span> : null}
      </label>
      <label className="full-span">
        <span>Notes</span>
        <span className="field-help">Internal description, such as the owner of the source or sync-specific details.</span>
        <textarea
          {...form.register("notes")}
          aria-invalid={Boolean(errors.notes)}
          className={errors.notes ? "input-invalid" : undefined}
          rows={3}
          placeholder="Internal notes about this source"
        />
        {errors.notes ? <span className="field-error">{errors.notes.message}</span> : null}
      </label>

      <SourceInstructionPanel type={selectedType as SourceType} />

      {selectedType !== "google" ? (
        <>
          <label className="full-span">
            <span>Server URL</span>
            <span className="field-help">Base URL or address book URL of the CardDAV server. The app runs discovery and contact fetches against it.</span>
            <input
              {...form.register("server_url")}
              aria-invalid={Boolean(errors.server_url)}
              className={errors.server_url ? "input-invalid" : undefined}
              placeholder="https://cloud.example.com/remote.php/dav/addressbooks/users/demo/"
            />
            {errors.server_url ? <span className="field-error">{errors.server_url.message}</span> : null}
          </label>
          <label>
            <span>Username</span>
            <span className="field-help">Login name for CardDAV or Nextcloud.</span>
            <input
              {...form.register("username")}
              aria-invalid={Boolean(errors.username)}
              className={errors.username ? "input-invalid" : undefined}
              placeholder="jonas"
            />
            {errors.username ? <span className="field-error">{errors.username.message}</span> : null}
          </label>
          <label>
            <span>Password / app password</span>
            <span className="field-help">Stored in the backend only. Leave empty on an existing source to keep the current value.</span>
            <input
              type="password"
              {...form.register("password")}
              aria-invalid={Boolean(errors.password)}
              className={errors.password ? "input-invalid" : undefined}
              placeholder={source ? "Leave empty to keep the current value" : ""}
            />
            {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
          </label>
        </>
      ) : (
        <>
          <label className="full-span">
            <span>Google Client ID</span>
            <span className="field-help">OAuth client ID from Google Cloud Console for this exact source account.</span>
            <input
              {...form.register("google_client_id")}
              aria-invalid={Boolean(errors.google_client_id)}
              className={errors.google_client_id ? "input-invalid" : undefined}
              placeholder="1234567890-abcdefg.apps.googleusercontent.com"
            />
            {errors.google_client_id ? <span className="field-error">{errors.google_client_id.message}</span> : null}
          </label>
          <label className="full-span">
            <span>Google Client Secret</span>
            <span className="field-help">Secret belonging to this client ID. Stored in the backend only.</span>
            <input
              type="password"
              {...form.register("google_client_secret")}
              aria-invalid={Boolean(errors.google_client_secret)}
              className={errors.google_client_secret ? "input-invalid" : undefined}
              placeholder={source ? "Leave empty to keep the current value" : "GOCSPX-..."}
            />
            {errors.google_client_secret ? <span className="field-error">{errors.google_client_secret.message}</span> : null}
          </label>
          <label className="full-span">
            <span>Redirect URI</span>
            <span className="field-help">Must match the Google configuration exactly. This is where the OAuth flow returns to the app.</span>
            <input
              {...form.register("google_redirect_uri")}
              aria-invalid={Boolean(errors.google_redirect_uri)}
              className={errors.google_redirect_uri ? "input-invalid" : undefined}
              placeholder="http://localhost:8000/api/sources/oauth/google/callback"
            />
            {errors.google_redirect_uri ? <span className="field-error">{errors.google_redirect_uri.message}</span> : null}
          </label>
          <label className="full-span">
            <span>Auth URI</span>
            <span className="field-help">OAuth authorization endpoint. Keep the Google default in normal setups.</span>
            <input
              {...form.register("google_auth_uri")}
              aria-invalid={Boolean(errors.google_auth_uri)}
              className={errors.google_auth_uri ? "input-invalid" : undefined}
              placeholder="https://accounts.google.com/o/oauth2/auth"
            />
            {errors.google_auth_uri ? <span className="field-error">{errors.google_auth_uri.message}</span> : null}
          </label>
          <label className="full-span">
            <span>Token URI</span>
            <span className="field-help">OAuth token endpoint used to exchange the code for access and refresh tokens.</span>
            <input
              {...form.register("token_uri")}
              aria-invalid={Boolean(errors.token_uri)}
              className={errors.token_uri ? "input-invalid" : undefined}
              placeholder="https://oauth2.googleapis.com/token"
            />
            {errors.token_uri ? <span className="field-error">{errors.token_uri.message}</span> : null}
          </label>
          <div className="callout full-span">
            After saving, the OAuth link can be started with the `Google OAuth` button in the source list.
          </div>
        </>
      )}
      <button type="submit" className="primary-button">
        {submitLabel}
      </button>
    </form>
  );
}
