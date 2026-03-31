import { useQuery } from "@tanstack/react-query";

import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { projectMeta } from "../lib/projectMeta";

export function AboutPage() {
  const { t } = useI18n();
  const { data: settings } = useQuery({ queryKey: ["app-settings"], queryFn: api.getAppSettings });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{t("aboutEyebrow")}</span>
          <h2>{t("aboutTitle")}</h2>
        </div>
      </header>
      <SectionCard title={t("aboutTitle")}>
        <div className="stack">
          <p className="subtle">{t("aboutSummary")}</p>
          <div className="list-card compact-card">
            <strong>{t("version")}</strong>
            <p className="subtle">{settings?.app_version ?? "0.2.1"}</p>
          </div>
          <div className="list-card compact-card">
            <strong>{t("releaseModel")}</strong>
            <p className="subtle">{settings?.release_model ?? "Semantic Versioning via Git tags"}</p>
          </div>
          <div className="list-card compact-card">
            <strong>{t("repository")}</strong>
            <p className="subtle">
              <a className="text-link" href={projectMeta.repositoryUrl} target="_blank" rel="noreferrer">
                {projectMeta.repositoryUrl}
              </a>
            </p>
          </div>
          <div className="list-card compact-card">
            <strong>{t("issues")}</strong>
            <p className="subtle">
              <a className="text-link" href={projectMeta.issuesUrl} target="_blank" rel="noreferrer">
                {projectMeta.issuesUrl}
              </a>
            </p>
          </div>
          <div className="list-card compact-card">
            <strong>{t("containers")}</strong>
            <p className="subtle">
              <a className="text-link" href={projectMeta.dockerHubUrl} target="_blank" rel="noreferrer">
                Docker Hub
              </a>
            </p>
          </div>
          <div className="list-card compact-card">
            <strong>{t("license")}</strong>
            <p className="subtle">{projectMeta.licenseName}</p>
          </div>
          <div className="list-card compact-card">
            <strong>{t("support")}</strong>
            <p className="subtle">
              <a className="text-link" href={projectMeta.supportUrl} target="_blank" rel="noreferrer">
                Community support and reporting guidance
              </a>
            </p>
          </div>
          <div className="callout">
            {t("support")}: GitHub issues are the default public contact channel for bugs, feature requests, and release discussions.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
