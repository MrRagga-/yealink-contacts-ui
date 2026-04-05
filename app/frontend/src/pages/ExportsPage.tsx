import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { QueryStatePanel } from "../components/QueryStatePanel";
import { SectionCard } from "../components/SectionCard";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";

const PREVIEW_LIMIT = 50;

export function ExportsPage() {
  const toast = useToast();
  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: api.getProfiles });
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
  const [includeXml, setIncludeXml] = useState(false);
  const previewQuery = useQuery({
    queryKey: ["preview", selectedProfileId, includeXml],
    queryFn: () => api.getPreview(selectedProfileId, { previewLimit: PREVIEW_LIMIT, includeXml }),
    enabled: (profilesQuery.data?.length ?? 0) > 0,
  });
  const profiles = profilesQuery.data ?? [];
  const preview = previewQuery.data;
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : api.apiBase;
  const selectedProfileXmlUrl = selectedProfile
    ? resolveXmlUrl(selectedProfile.slug, selectedProfile.xml_url)
    : null;

  function resolveXmlUrl(slug: string, fallbackUrl: string) {
    if (!currentOrigin.startsWith("http://") && !currentOrigin.startsWith("https://")) {
      return fallbackUrl;
    }
    return `${currentOrigin}/api/yealink/phonebook/${slug}.xml`;
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.push("success", "URL copied to clipboard.");
    } catch {
      toast.push("error", "Failed to copy URL.");
    }
  }

  function handleProfileChange(nextProfileId: string | undefined) {
    setIncludeXml(false);
    setSelectedProfileId(nextProfileId);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Preview First</span>
          <h2>Yealink export and XML preview</h2>
        </div>
        <label>
          <span>Profile</span>
          <span className="field-help">Selects which rule profile is used for preview, XML output, and Yealink links.</span>
          <select
            disabled={!profiles.length}
            value={selectedProfileId ?? ""}
            onChange={(event) => handleProfileChange(event.target.value || undefined)}
          >
            <option value="">Automatic preview</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="two-column two-column-wide">
        <SectionCard title="Yealink links">
          {profilesQuery.isPending ? (
            <QueryStatePanel
              message="Loading export profiles and XML endpoints."
              title="Loading export profiles"
              tone="loading"
            />
          ) : profilesQuery.error ? (
            <QueryStatePanel
              message={(profilesQuery.error as Error).message}
              title="Could not load export profiles"
              tone="error"
            />
          ) : profiles.length ? (
            <div className="stack">
              <div className="callout">
                Yealink normally fetches the XML from this application over HTTP. This is a `pull` model.
                The app does not push contacts directly into the phone.
              </div>
              {profiles.map((profile) => {
                const effectiveXmlUrl = resolveXmlUrl(profile.slug, profile.xml_url);
                const isLocalUrl =
                  effectiveXmlUrl.includes("://localhost") || effectiveXmlUrl.includes("://127.0.0.1");
                return (
                  <article key={profile.id} className="list-card endpoint-card">
                    <div className="list-card-header">
                      <div>
                        <strong>{profile.name}</strong>
                        <p>{profile.description || "Yealink remote phonebook"}</p>
                      </div>
                      <span className={`status-pill ${profile.is_active ? "status-success" : "status-muted"}`}>
                        {profile.slug}
                      </span>
                    </div>
                    <div className="endpoint-url">{effectiveXmlUrl}</div>
                    <div className="button-row">
                      <a className="ghost-button link-button" href={effectiveXmlUrl} target="_blank" rel="noreferrer">
                        Open XML
                      </a>
                      <button className="ghost-button" onClick={() => copyText(effectiveXmlUrl)}>
                        Copy URL
                      </button>
                    </div>
                    {isLocalUrl ? (
                      <div className="warning-box">
                        `localhost` only works in the browser on this machine. For a real Yealink phone, the URL must be reachable via hostname or LAN IP.
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <QueryStatePanel
              message="Create an export profile to preview XML output and generate Yealink URLs."
              title="No export profiles yet"
            />
          )}
        </SectionCard>
        <SectionCard title="How to connect Yealink">
          <div className="stack">
            <div className="instruction-block">
              <strong>1. Configure per phone in the web UI</strong>
              <ol className="instruction-list">
                <li>Open the Yealink web interface as admin in your browser.</li>
                <li>
                  Go to <code>Directory &gt; Remote Phonebook</code>. Depending on the firmware, the area may also appear under <code>Contacts &gt; Remote Phone Book</code>.
                </li>
                <li>
                  In the <code>Name</code> field, enter something like <code>{selectedProfile?.name ?? "Team Directory"}</code>.
                </li>
                <li>
                  In the <code>Phone Book URL</code> field, enter this URL:
                  <div className="endpoint-url compact">
                    {selectedProfileXmlUrl ?? "Select a specific profile above to pin a fixed XML URL for the phone."}
                  </div>
                </li>
                <li>Save with <code>Confirm</code>.</li>
                <li>On the phone, open or refresh the remote phonebook under <code>Directory</code>.</li>
              </ol>
            </div>
            <div className="instruction-block">
              <strong>2. Roll out centrally via provisioning</strong>
              <p className="subtle">
                If you manage many phones, you do not push the contacts themselves. You roll out the configuration that points to this XML.
              </p>
              <pre className="provision-snippet">
                {selectedProfile
                  ? `remote_phonebook.data.1.name = ${selectedProfile.name}
remote_phonebook.data.1.url = ${selectedProfileXmlUrl}`
                  : "# Select a specific profile above before rolling out a fixed provisioning snippet."}
              </pre>
              <p className="subtle">
                For multiple departments, additional entries such as <code>remote_phonebook.data.2.*</code> and{" "}
                <code>remote_phonebook.data.3.*</code> can point to more export profiles.
              </p>
            </div>
            <div className="instruction-block">
              <strong>3. Reachability requirements</strong>
              <ul className="instruction-list">
                <li>The URL must be reachable from the phone's perspective.</li>
                <li>If you see a `localhost` URL in the UI, it is not suitable for the phone yet.</li>
                <li>DNS, firewall, and reverse proxy must allow HTTP or HTTPS to this XML URL.</li>
              </ul>
            </div>
            <div className="button-row">
              <a
                className="ghost-button link-button"
                href="https://support.yealink.com/document-detail/50c71e649d5747acbb7a43936946dba0"
                target="_blank"
                rel="noreferrer"
              >
                Yealink Remote Phone Book docs
              </a>
              <a
                className="ghost-button link-button"
                href="https://support.yealink.com/forward2filesystem/attachment/upload/attachment/2015-3-12/3/c53258fc-d4b4-496f-88a0-540b328d5c49/Yealink_SIP-T3xG_IP%2BPhone_Family_Administrator_Guide_V70.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Yealink admin guide
              </a>
            </div>
          </div>
        </SectionCard>
      </div>
      <div className="two-column two-column-wide">
        <SectionCard title={`Exported (${preview?.exported_total ?? 0})`}>
          {previewQuery.isPending ? (
            <QueryStatePanel
              message="Building the export preview for the active profile selection."
              title="Loading preview"
              tone="loading"
            />
          ) : previewQuery.error ? (
            <QueryStatePanel
              message={(previewQuery.error as Error).message}
              title="Could not load exported contacts"
              tone="error"
            />
          ) : preview?.exported.length ? (
            <div className="stack">
              {preview.preview_limit && preview.exported_total > preview.exported.length ? (
                <div className="info-box">
                  Showing the first {preview.exported.length} exported contacts out of {preview.exported_total}.
                </div>
              ) : null}
              {preview.exported.map((item) => (
                <article key={item.contact_id} className="list-card compact-card">
                  <strong>{item.display_name || item.original_name || "Unnamed"}</strong>
                  <p className="subtle">{item.selected_numbers.map((phone) => phone.normalized_e164 || phone.value).join(", ")}</p>
                  <p className="subtle">{item.explanation.reasons.join(" · ")}</p>
                </article>
              ))}
            </div>
          ) : (
            <QueryStatePanel
              message={profiles.length ? "No contacts are currently exported by this profile." : "Create a profile to generate a preview."}
              title="No exported contacts"
            />
          )}
        </SectionCard>
        <SectionCard title={`Discarded (${preview?.discarded_total ?? 0})`}>
          {previewQuery.isPending ? (
            <QueryStatePanel
              message="Collecting the discarded contacts for this export profile."
              title="Loading discarded contacts"
              tone="loading"
            />
          ) : previewQuery.error ? (
            <QueryStatePanel
              message={(previewQuery.error as Error).message}
              title="Could not load discarded contacts"
              tone="error"
            />
          ) : preview?.discarded.length ? (
            <div className="stack">
              {preview.preview_limit && preview.discarded_total > preview.discarded.length ? (
                <div className="info-box">
                  Showing the first {preview.discarded.length} discarded contacts out of {preview.discarded_total}.
                </div>
              ) : null}
              {preview.discarded.map((item) => (
                <article key={item.contact_id} className="list-card compact-card">
                  <strong>{item.original_name || "Unnamed"}</strong>
                  <p className="subtle">{item.explanation.reasons.join(" · ")}</p>
                </article>
              ))}
            </div>
          ) : (
            <QueryStatePanel message="No contacts are currently being discarded for this profile." title="No discarded contacts" />
          )}
        </SectionCard>
      </div>
      <SectionCard title="Generated XML">
        {previewQuery.isPending ? (
          <QueryStatePanel
            message="Generating XML for the active preview."
            title="Loading XML"
            tone="loading"
          />
        ) : previewQuery.error ? (
          <QueryStatePanel
            message={(previewQuery.error as Error).message}
            title="Could not load generated XML"
            tone="error"
          />
        ) : preview ? (
          <>
            <p className="subtle">
              {selectedProfile
                ? "The XML is generated from the selected profile and served to Yealink exactly as shown here."
                : "The XML preview below reflects the backend's automatic/default profile selection. Choose a specific profile above to inspect a fixed profile export."}
            </p>
            {includeXml && preview.generated_xml ? (
              <textarea className="code-area" value={preview.generated_xml} readOnly rows={20} />
            ) : (
              <div className="stack">
                <div className="info-box">
                  XML generation is loaded on demand to keep the preview responsive for larger contact sets.
                </div>
                <div className="button-row">
                  <button className="ghost-button" onClick={() => setIncludeXml(true)}>
                    Load generated XML
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <QueryStatePanel message="Select or create a profile to generate XML output." title="No XML preview yet" />
        )}
      </SectionCard>
    </div>
  );
}
