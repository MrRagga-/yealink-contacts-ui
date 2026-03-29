import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { useToast } from "../hooks/useToast";
import { api } from "../lib/api";

export function ExportsPage() {
  const toast = useToast();
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: api.getProfiles });
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(undefined);
  const { data: preview } = useQuery({
    queryKey: ["preview", selectedProfileId],
    queryFn: () => api.getPreview(selectedProfileId),
  });
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0];
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : api.apiBase;

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
          <select value={selectedProfileId ?? ""} onChange={(event) => setSelectedProfileId(event.target.value || undefined)}>
            <option value="">Automatic</option>
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
                  In the <code>Name</code> field, enter something like <code>{selectedProfile?.name ?? "Default"}</code>.
                </li>
                <li>
                  In the <code>Phone Book URL</code> field, enter this URL:
                  <div className="endpoint-url compact">
                    {selectedProfile
                      ? resolveXmlUrl(selectedProfile.slug, selectedProfile.xml_url)
                      : "No profile selected"}
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
              <pre className="provision-snippet">{`remote_phonebook.data.1.name = ${selectedProfile?.name ?? "Default"}
remote_phonebook.data.1.url = ${
                selectedProfile
                  ? resolveXmlUrl(selectedProfile.slug, selectedProfile.xml_url)
                  : "http://<server>:5173/api/yealink/phonebook/default.xml"
              }`}</pre>
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
        <SectionCard title={`Exported (${preview?.exported.length ?? 0})`}>
          <div className="stack">
            {preview?.exported.map((item) => (
              <article key={item.contact_id} className="list-card compact-card">
                <strong>{item.display_name || item.original_name || "Unnamed"}</strong>
                <p className="subtle">{item.selected_numbers.map((phone) => phone.normalized_e164 || phone.value).join(", ")}</p>
                <p className="subtle">{item.explanation.reasons.join(" · ")}</p>
              </article>
            ))}
          </div>
        </SectionCard>
        <SectionCard title={`Discarded (${preview?.discarded.length ?? 0})`}>
          <div className="stack">
            {preview?.discarded.map((item) => (
              <article key={item.contact_id} className="list-card compact-card">
                <strong>{item.original_name || "Unnamed"}</strong>
                <p className="subtle">{item.explanation.reasons.join(" · ")}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Generated XML">
        <p className="subtle">The XML is generated from the currently selected profile and served to Yealink exactly as shown here.</p>
        <textarea className="code-area" value={preview?.generated_xml ?? ""} readOnly rows={20} />
      </SectionCard>
    </div>
  );
}
