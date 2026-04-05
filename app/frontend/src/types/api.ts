export type SourceType = "google" | "carddav" | "nextcloud_carddav";
export type SourceMergeStrategy = "upsert_only" | "mirror_source";

export type AuthenticatedAdmin = {
  id: string;
  username: string;
  must_change_password: boolean;
  is_active: boolean;
  passkey_count: number;
};

export type PasskeyCredential = {
  id: string;
  label: string;
  transports: string[];
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
};

export type AppSettings = {
  app_version: string;
  release_model: string;
  default_new_source_type: SourceType;
  default_new_source_merge_strategy: SourceMergeStrategy;
  default_profile_allowed_types: string[];
  default_profile_excluded_types: string[];
  default_profile_priority_order: string[];
  default_profile_max_numbers_per_contact: number;
  default_profile_name_expression: string;
  default_profile_prefix: string;
  default_profile_suffix: string;
  debug_enabled: boolean;
  admin_allowed_cidrs: string[];
  xml_allowed_cidrs: string[];
};

export type SourceAddressbook = {
  id?: string;
  source_id?: string;
  remote_id: string;
  href: string;
  display_name: string;
  description?: string | null;
  is_selected: boolean;
  sync_token?: string | null;
};

export type CardDavSourceCredentialSummary = {
  merge_strategy: SourceMergeStrategy;
  server_url?: string;
  username?: string;
};

export type GoogleSourceCredentialSummary = {
  merge_strategy: SourceMergeStrategy;
  account_email?: string;
  google_client_id?: string;
  google_redirect_uri?: string;
  google_auth_uri?: string;
  token_uri?: string;
  google_client_secret_configured?: boolean;
  google_refresh_token_configured?: boolean;
};

export type SourceCredentialSummary =
  | CardDavSourceCredentialSummary
  | GoogleSourceCredentialSummary;

export type CardDavSourceCredentialPayload = {
  merge_strategy?: SourceMergeStrategy;
  server_url?: string;
  username?: string;
  password?: string;
};

export type GoogleSourceCredentialPayload = {
  merge_strategy?: SourceMergeStrategy;
  google_client_id?: string;
  google_client_secret?: string;
  google_redirect_uri?: string;
  google_auth_uri?: string;
  token_uri?: string;
};

type SourceBase = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  notes?: string | null;
  tags: string[];
  last_successful_sync_at?: string | null;
  last_error?: string | null;
  addressbooks: SourceAddressbook[];
};

export type CardDavSource = SourceBase & {
  type: "carddav" | "nextcloud_carddav";
  credential_summary: CardDavSourceCredentialSummary;
};

export type GoogleSource = SourceBase & {
  type: "google";
  credential_summary: GoogleSourceCredentialSummary;
};

export type Source = CardDavSource | GoogleSource;

type SourceCreatePayloadBase = {
  name: string;
  slug: string;
  is_active: boolean;
  notes?: string;
  tags: string[];
  addressbooks: SourceAddressbook[];
};

export type CardDavSourceCreatePayload = SourceCreatePayloadBase & {
  type: "carddav" | "nextcloud_carddav";
  credential: CardDavSourceCredentialPayload;
};

export type GoogleSourceCreatePayload = SourceCreatePayloadBase & {
  type: "google";
  credential: GoogleSourceCredentialPayload;
};

export type SourceCreatePayload = CardDavSourceCreatePayload | GoogleSourceCreatePayload;

export type SourceUpdatePayload = Partial<{
  name: string;
  slug: string;
  is_active: boolean;
  notes: string;
  tags: string[];
  addressbooks: SourceAddressbook[];
}> &
  (
    | { type?: "google"; credential?: GoogleSourceCredentialPayload }
    | { type?: "carddav" | "nextcloud_carddav"; credential?: CardDavSourceCredentialPayload }
  );

export type DuplicateHint = {
  kind: string;
  value: string;
  related_contact_ids: string[];
  score: number;
};

export type ContactPhone = {
  id: string;
  value: string;
  normalized_e164?: string | null;
  type: string;
  label?: string | null;
  is_primary: boolean;
  source_position: number;
  is_valid: boolean;
};

export type Contact = {
  id: string;
  source_id: string;
  source_contact_id: string;
  full_name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  organization?: string | null;
  nickname?: string | null;
  notes?: string | null;
  groups: string[];
  photo_url?: string | null;
  raw_payload: Record<string, unknown>;
  content_hash: string;
  updated_at_source?: string | null;
  last_synced_at?: string | null;
  phone_numbers: ContactPhone[];
  emails: Array<{ id: string; value: string; type: string; is_primary: boolean }>;
  addresses: Array<{ id: string; type: string; street?: string | null; city?: string | null }>;
  duplicate_hints: DuplicateHint[];
};

export type ContactListResponse = {
  items: Contact[];
  total: number;
  offset: number;
  limit: number;
};

export type RuleSetConfig = {
  filters: {
    include_source_ids: string[];
    exclude_source_ids: string[];
    include_groups: string[];
    search_query?: string | null;
    blacklist_contact_ids: string[];
    blacklist_numbers: string[];
    require_phone: boolean;
  };
  phone_selection: {
    allowed_types: string[];
    excluded_types: string[];
    priority_order: string[];
    require_phone: boolean;
    max_numbers_per_contact: number;
    normalize_to_e164: boolean;
  };
  name_template: {
    expression: string;
    prefix: string;
    suffix: string;
    normalize_whitespace: boolean;
  };
};

export type ExportProfile = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
  rule_set: RuleSetConfig;
  xml_url: string;
};

export type ExportProfilePayload = {
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, never>;
  rule_set: RuleSetConfig;
};

export type ExportPreviewItem = {
  contact_id: string;
  source_id: string;
  source_name: string;
  original_name?: string | null;
  display_name?: string | null;
  selected_numbers: Array<{
    value: string;
    normalized_e164?: string | null;
    type: string;
  }>;
  explanation: {
    included: boolean;
    display_name?: string | null;
    reasons: string[];
    discarded_numbers: string[];
  };
  duplicate_hints: DuplicateHint[];
};

export type ExportPreviewResponse = {
  profile_id: string;
  profile_slug: string;
  exported_total: number;
  discarded_total: number;
  preview_limit?: number | null;
  exported: ExportPreviewItem[];
  discarded: ExportPreviewItem[];
  generated_xml?: string | null;
};

export type DashboardResponse = {
  source_count: number;
  active_source_count: number;
  export_profile_count: number;
  contact_count: number;
  exported_contact_count: number;
  last_sync?: string | null;
  xml_endpoints: string[];
  recent_errors: string[];
};

export type SyncJob = {
  id: string;
  source_id?: string | null;
  status: string;
  trigger_type: string;
  started_at?: string | null;
  finished_at?: string | null;
  summary: Record<string, unknown>;
  error_message?: string | null;
  events: Array<{ id: string; level: string; message: string; details: Record<string, unknown> }>;
};

export type LogsResponse = {
  audit_logs: Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    action: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  job_events: Array<{
    id: string;
    sync_job_id: string;
    level: string;
    message: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
};
