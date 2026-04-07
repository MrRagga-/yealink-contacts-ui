import { z } from "zod";

import type {
  AppSettings,
  CardDavSourceCreatePayload,
  GoogleSourceCreatePayload,
  Source,
  SourceCreatePayload,
  SourceMergeStrategy,
  SourceType,
} from "../../types/api";

export const sourceSchema = z.object({
  name: z.string().min(2, "Enter a source name with at least 2 characters."),
  slug: z.string().min(2, "Enter a slug with at least 2 characters."),
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

export type SourceFormInput = z.input<typeof sourceSchema>;
export type SourceFormValues = z.output<typeof sourceSchema>;

export function getSourceFormDefaults(
  source?: Source,
  defaults?: AppSettings,
): SourceFormValues {
  const isGoogleSource = source?.type === "google";

  return {
    name: source?.name ?? "",
    slug: source?.slug ?? "",
    type: source?.type ?? defaults?.default_new_source_type ?? "carddav",
    merge_strategy: String(
      source?.credential_summary.merge_strategy
        ?? defaults?.default_new_source_merge_strategy
        ?? "upsert_only",
    ) as SourceMergeStrategy,
    is_active: source?.is_active ?? true,
    notes: source?.notes ?? "",
    tags: source?.tags.join(", ") ?? "",
    server_url: String(!isGoogleSource ? source?.credential_summary.server_url ?? "" : ""),
    username: String(!isGoogleSource ? source?.credential_summary.username ?? "" : ""),
    password: "",
    google_client_id: String(isGoogleSource ? source?.credential_summary.google_client_id ?? "" : ""),
    google_client_secret: "",
    google_redirect_uri: String(
      (isGoogleSource ? source?.credential_summary.google_redirect_uri : undefined)
        ?? "http://localhost:8000/api/sources/oauth/google/callback",
    ),
    google_auth_uri: String(
      (isGoogleSource ? source?.credential_summary.google_auth_uri : undefined)
      ?? "https://accounts.google.com/o/oauth2/auth",
    ),
    token_uri: String(
      (isGoogleSource ? source?.credential_summary.token_uri : undefined)
      ?? "https://oauth2.googleapis.com/token",
    ),
  };
}

export function buildSourcePayload(
  values: SourceFormValues,
  source?: Source,
): SourceCreatePayload {
  const basePayload = {
    name: values.name,
    slug: values.slug,
    is_active: values.is_active,
    notes: values.notes,
    tags: values.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    addressbooks: source?.addressbooks ?? [],
  };

  if (values.type === "google") {
    const payload: GoogleSourceCreatePayload = {
      ...basePayload,
      type: values.type,
      credential: {
        merge_strategy: values.merge_strategy,
        google_client_id: values.google_client_id,
        google_client_secret: values.google_client_secret,
        google_redirect_uri: values.google_redirect_uri,
        google_auth_uri: values.google_auth_uri,
        token_uri: values.token_uri,
      },
    };
    return payload;
  }

  const payload: CardDavSourceCreatePayload = {
    ...basePayload,
    type: values.type as Exclude<SourceType, "google">,
    credential: {
      merge_strategy: values.merge_strategy,
      server_url: values.server_url,
      username: values.username,
      password: values.password,
    },
  };
  return payload;
}
