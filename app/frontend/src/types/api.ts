export type SourceType = "google" | "carddav" | "nextcloud_carddav";
export type SourceMergeStrategy = "upsert_only" | "mirror_source";

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

export type Source = {
  id: string;
  name: string;
  slug: string;
  type: SourceType;
  is_active: boolean;
  notes?: string | null;
  tags: string[];
  last_successful_sync_at?: string | null;
  last_error?: string | null;
  addressbooks: SourceAddressbook[];
  credential_summary: Record<string, unknown>;
};

export type SourceCreatePayload = {
  name: string;
  slug: string;
  type: SourceType;
  is_active: boolean;
  notes?: string;
  tags: string[];
  credential: {
    merge_strategy?: SourceMergeStrategy;
    server_url?: string;
    username?: string;
    password?: string;
    google_client_id?: string;
    google_client_secret?: string;
    google_redirect_uri?: string;
    google_auth_uri?: string;
    token_uri?: string;
  };
  addressbooks: SourceAddressbook[];
};

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
  exported: ExportPreviewItem[];
  discarded: ExportPreviewItem[];
  generated_xml: string;
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
