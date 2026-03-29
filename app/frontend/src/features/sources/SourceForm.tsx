import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { AppSettings, Source, SourceCreatePayload, SourceMergeStrategy, SourceType } from "../../types/api";

const sourceSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  type: z.enum(["google", "carddav", "nextcloud_carddav"]),
  merge_strategy: z.enum(["upsert_only", "mirror_source"]),
  is_active: z.boolean(),
  notes: z.string().optional(),
  tags: z.string().default(""),
  server_url: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  google_client_id: z.string().optional(),
  google_client_secret: z.string().optional(),
  google_redirect_uri: z.string().optional(),
  google_auth_uri: z.string().optional(),
  token_uri: z.string().optional(),
});

type SourceFormValues = z.infer<typeof sourceSchema>;

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
  const form = useForm<SourceFormValues>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: source?.name ?? "",
      slug: source?.slug ?? "",
      type: source?.type ?? defaults?.default_new_source_type ?? "carddav",
      merge_strategy: String(
        source?.credential_summary.merge_strategy ?? defaults?.default_new_source_merge_strategy ?? "upsert_only",
      ) as SourceMergeStrategy,
      is_active: source?.is_active ?? true,
      notes: source?.notes ?? "",
      tags: source?.tags.join(", ") ?? "",
      server_url: String(source?.credential_summary.server_url ?? ""),
      username: String(source?.credential_summary.username ?? ""),
      password: "",
      google_client_id: String(source?.credential_summary.google_client_id ?? ""),
      google_client_secret: "",
      google_redirect_uri: String(
        source?.credential_summary.google_redirect_uri ?? "http://localhost:8000/api/sources/oauth/google/callback",
      ),
      google_auth_uri: String(
        source?.credential_summary.google_auth_uri ?? "https://accounts.google.com/o/oauth2/auth",
      ),
      token_uri: String(source?.credential_summary.token_uri ?? "https://oauth2.googleapis.com/token"),
    },
  });

  const selectedType = form.watch("type");

  useEffect(() => {
    if (source) {
      form.reset({
        name: source.name,
        slug: source.slug,
        type: source.type,
        merge_strategy: String(source.credential_summary.merge_strategy ?? "upsert_only") as SourceMergeStrategy,
        is_active: source.is_active,
        notes: source.notes ?? "",
        tags: source.tags.join(", "),
        server_url: String(source.credential_summary.server_url ?? ""),
        username: String(source.credential_summary.username ?? ""),
        password: "",
        google_client_id: String(source.credential_summary.google_client_id ?? ""),
        google_client_secret: "",
        google_redirect_uri: String(
          source.credential_summary.google_redirect_uri ?? "http://localhost:8000/api/sources/oauth/google/callback",
        ),
        google_auth_uri: String(
          source.credential_summary.google_auth_uri ?? "https://accounts.google.com/o/oauth2/auth",
        ),
        token_uri: String(source.credential_summary.token_uri ?? "https://oauth2.googleapis.com/token"),
      });
      return;
    }
    form.reset((currentValues) => ({
      ...currentValues,
      type: defaults?.default_new_source_type ?? "carddav",
      merge_strategy: defaults?.default_new_source_merge_strategy ?? "upsert_only",
    }));
  }, [defaults, form, source]);

  return (
    <form
      className="form-grid"
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          name: values.name,
          slug: values.slug,
          type: values.type as SourceType,
          is_active: values.is_active,
          notes: values.notes,
          tags: values.tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          credential:
            values.type === "google"
              ? {
                  merge_strategy: values.merge_strategy,
                  google_client_id: values.google_client_id,
                  google_client_secret: values.google_client_secret,
                  google_redirect_uri: values.google_redirect_uri,
                  google_auth_uri: values.google_auth_uri,
                  token_uri: values.token_uri,
                }
              : {
                  merge_strategy: values.merge_strategy,
                  server_url: values.server_url,
                  username: values.username,
                  password: values.password,
                },
          addressbooks: source?.addressbooks ?? [],
        })
      )}
    >
      <label>
        <span>Name</span>
        <span className="field-help">Display name of the source in the admin UI.</span>
        <input {...form.register("name")} placeholder="Company CardDAV" />
      </label>
      <label>
        <span>Slug</span>
        <span className="field-help">Technical short name used in APIs and internal references.</span>
        <input {...form.register("slug")} placeholder="company-carddav" />
      </label>
      <label>
        <span>Type</span>
        <span className="field-help">Determines which credentials and adapter implementation are used for this source.</span>
        <select {...form.register("type")}>
          <option value="google">Google Contacts</option>
          <option value="carddav">CardDAV</option>
          <option value="nextcloud_carddav">Nextcloud Contacts</option>
        </select>
      </label>
      <label>
        <span>Merge strategy</span>
        <span className="field-help">
          Controls whether contacts missing in the source remain locally or are also deleted on the next successful sync.
        </span>
        <select {...form.register("merge_strategy")}>
          <option value="upsert_only">Import and update only, never delete locally</option>
          <option value="mirror_source">Mirror source and delete locally removed contacts</option>
        </select>
      </label>
      <label className="checkbox-row">
        <input type="checkbox" {...form.register("is_active")} />
        <span>Source active</span>
      </label>
      <label className="full-span">
        <span>Tags</span>
        <span className="field-help">Comma-separated tags used later for filtering and documentation.</span>
        <input {...form.register("tags")} placeholder="private, team, priority" />
      </label>
      <label className="full-span">
        <span>Notes</span>
        <span className="field-help">Internal description, such as the owner of the source or sync-specific details.</span>
        <textarea {...form.register("notes")} rows={3} placeholder="Internal notes about this source" />
      </label>

      <SourceInstructionPanel type={selectedType as SourceType} />

      {selectedType !== "google" ? (
        <>
          <label className="full-span">
            <span>Server URL</span>
            <span className="field-help">Base URL or address book URL of the CardDAV server. The app runs discovery and contact fetches against it.</span>
            <input {...form.register("server_url")} placeholder="https://cloud.example.com/remote.php/dav/addressbooks/users/demo/" />
          </label>
          <label>
            <span>Username</span>
            <span className="field-help">Login name for CardDAV or Nextcloud.</span>
            <input {...form.register("username")} placeholder="jonas" />
          </label>
          <label>
            <span>Password / app password</span>
            <span className="field-help">Stored in the backend only. Leave empty on an existing source to keep the current value.</span>
            <input type="password" {...form.register("password")} placeholder={source ? "Leave empty to keep the current value" : ""} />
          </label>
        </>
      ) : (
        <>
          <label className="full-span">
            <span>Google Client ID</span>
            <span className="field-help">OAuth client ID from Google Cloud Console for this exact source account.</span>
            <input
              {...form.register("google_client_id")}
              placeholder="1234567890-abcdefg.apps.googleusercontent.com"
            />
          </label>
          <label className="full-span">
            <span>Google Client Secret</span>
            <span className="field-help">Secret belonging to this client ID. Stored in the backend only.</span>
            <input
              type="password"
              {...form.register("google_client_secret")}
              placeholder={source ? "Leave empty to keep the current value" : "GOCSPX-..."}
            />
          </label>
          <label className="full-span">
            <span>Redirect URI</span>
            <span className="field-help">Must match the Google configuration exactly. This is where the OAuth flow returns to the app.</span>
            <input
              {...form.register("google_redirect_uri")}
              placeholder="http://localhost:8000/api/sources/oauth/google/callback"
            />
          </label>
          <label className="full-span">
            <span>Auth URI</span>
            <span className="field-help">OAuth authorization endpoint. Keep the Google default in normal setups.</span>
            <input
              {...form.register("google_auth_uri")}
              placeholder="https://accounts.google.com/o/oauth2/auth"
            />
          </label>
          <label className="full-span">
            <span>Token URI</span>
            <span className="field-help">OAuth token endpoint used to exchange the code for access and refresh tokens.</span>
            <input
              {...form.register("token_uri")}
              placeholder="https://oauth2.googleapis.com/token"
            />
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
