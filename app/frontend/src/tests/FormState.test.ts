import { describe, expect, test } from "vitest";

import {
  buildExportProfilePayload,
  getProfileFormDefaults,
} from "../features/exportProfiles/formState";
import {
  buildSettingsPayload,
  getSettingsFormValues,
} from "../features/settings/formState";
import {
  buildSourcePayload,
  getSourceFormDefaults,
} from "../features/sources/formState";
import {
  buildSyncResultFeedback,
} from "../features/sources/syncFeedback";

describe("source form state helpers", () => {
  test("builds a google source payload from form values", () => {
    const payload = buildSourcePayload(
      {
        name: "Google Team",
        slug: "google-team",
        type: "google",
        merge_strategy: "upsert_only",
        is_active: true,
        notes: "",
        tags: "team, directory",
        server_url: "",
        username: "",
        password: "",
        google_client_id: "client-id",
        google_client_secret: "client-secret",
        google_redirect_uri: "http://localhost:8000/api/sources/oauth/google/callback",
        google_auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
      },
      undefined,
    );

    expect(payload).toEqual({
      name: "Google Team",
      slug: "google-team",
      type: "google",
      is_active: true,
      notes: "",
      tags: ["team", "directory"],
      credential: {
        merge_strategy: "upsert_only",
        google_client_id: "client-id",
        google_client_secret: "client-secret",
        google_redirect_uri: "http://localhost:8000/api/sources/oauth/google/callback",
        google_auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
      },
      addressbooks: [],
    });
  });

  test("hydrates source defaults from an existing source", () => {
    const defaults = getSourceFormDefaults({
      id: "source-1",
      name: "Directory",
      slug: "directory",
      type: "carddav",
      is_active: true,
      notes: "Notes",
      tags: ["team"],
      last_successful_sync_at: null,
      last_error: null,
      addressbooks: [],
      credential_summary: {
        merge_strategy: "mirror_source",
        server_url: "https://dav.example.com",
        username: "demo",
      },
    });

    expect(defaults.merge_strategy).toBe("mirror_source");
    expect(defaults.server_url).toBe("https://dav.example.com");
    expect(defaults.username).toBe("demo");
  });
});

describe("export profile form state helpers", () => {
  test("builds an explicit export profile payload", () => {
    const payload = buildExportProfilePayload(
      {
        name: "Sales",
        slug: "sales",
        description: "",
        is_active: true,
        sort_order: 1,
        include_groups: "sales, support",
        search_query: "",
        allowed_types: "mobile,work",
        excluded_types: "fax",
        priority_order: "mobile,work",
        max_numbers_per_contact: 2,
        expression: "{full_name}",
        prefix: "",
        suffix: "",
      },
      ["source-1"],
    );

    expect(payload.rule_set.filters.include_groups).toEqual(["sales", "support"]);
    expect(payload.rule_set.phone_selection.allowed_types).toEqual(["mobile", "work"]);
    expect(payload.rule_set.filters.include_source_ids).toEqual(["source-1"]);
  });

  test("hydrates export profile defaults from an existing profile", () => {
    const defaults = getProfileFormDefaults({
      id: "profile-1",
      name: "Default",
      slug: "default",
      description: null,
      is_active: true,
      sort_order: 0,
      metadata: {},
      xml_url: "http://localhost:5173/api/yealink/phonebook/default.xml",
      rule_set: {
        filters: {
          include_source_ids: ["source-1"],
          exclude_source_ids: [],
          include_groups: ["sales"],
          search_query: null,
          blacklist_contact_ids: [],
          blacklist_numbers: [],
          require_phone: true,
        },
        phone_selection: {
          allowed_types: ["mobile"],
          excluded_types: [],
          priority_order: ["mobile"],
          require_phone: true,
          max_numbers_per_contact: 1,
          normalize_to_e164: true,
        },
        name_template: {
          expression: "{full_name}",
          prefix: "",
          suffix: "",
          normalize_whitespace: true,
        },
      },
    });

    expect(defaults.include_groups).toBe("sales");
    expect(defaults.allowed_types).toBe("mobile");
  });
});

describe("settings form state helpers", () => {
  test("builds a settings payload from form values", () => {
    const payload = buildSettingsPayload({
      default_new_source_type: "google",
      default_new_source_merge_strategy: "mirror_source",
      default_profile_allowed_types: "mobile,work",
      default_profile_excluded_types: "fax",
      default_profile_priority_order: "mobile,work",
      default_profile_max_numbers_per_contact: 2,
      default_profile_name_expression: "{full_name}",
      default_profile_prefix: "VIP - ",
      default_profile_suffix: "",
      debug_enabled: true,
      admin_allowed_cidrs: "10.0.0.0/8\n192.168.0.0/16",
      xml_allowed_cidrs: "10.0.0.0/8",
    });

    expect(payload.default_profile_allowed_types).toEqual(["mobile", "work"]);
    expect(payload.admin_allowed_cidrs).toEqual(["10.0.0.0/8", "192.168.0.0/16"]);
    expect(payload.debug_enabled).toBe(true);
  });

  test("hydrates settings defaults from app settings", () => {
    const defaults = getSettingsFormValues({
      app_version: "0.2.3",
      release_model: "Semantic Versioning via Git tags",
      default_new_source_type: "carddav",
      default_new_source_merge_strategy: "upsert_only",
      default_profile_allowed_types: ["mobile"],
      default_profile_excluded_types: ["fax"],
      default_profile_priority_order: ["mobile"],
      default_profile_max_numbers_per_contact: 2,
      default_profile_name_expression: "{full_name}",
      default_profile_prefix: "",
      default_profile_suffix: "",
      debug_enabled: false,
      admin_allowed_cidrs: ["0.0.0.0/0"],
      xml_allowed_cidrs: ["0.0.0.0/0"],
    });

    expect(defaults.default_profile_allowed_types).toBe("mobile");
    expect(defaults.admin_allowed_cidrs).toBe("0.0.0.0/0");
  });
});

describe("source sync feedback helpers", () => {
  test("returns informational feedback for queued jobs", () => {
    const feedback = buildSyncResultFeedback({
      id: "job-1",
      status: "pending",
      trigger_type: "manual",
      summary: {},
      events: [],
    } as never);

    expect(feedback.tone).toBe("info");
    expect(feedback.message).toContain("queued");
  });

  test("returns informational feedback for running jobs", () => {
    const feedback = buildSyncResultFeedback({
      id: "job-2",
      status: "running",
      trigger_type: "manual",
      summary: {},
      events: [],
    } as never);

    expect(feedback.tone).toBe("info");
    expect(feedback.message).toContain("background");
  });
});
