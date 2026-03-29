export const projectMeta = {
  repositoryUrl: import.meta.env.VITE_GITHUB_URL ?? "https://github.com/MrRagga-/yealink-contacts-ui",
  issuesUrl: import.meta.env.VITE_GITHUB_ISSUES_URL ?? "https://github.com/MrRagga-/yealink-contacts-ui/issues",
  ghcrBackendUrl:
    import.meta.env.VITE_GHCR_BACKEND_URL ??
    "https://github.com/MrRagga-/yealink-contacts-ui/pkgs/container/yealink-contacts-ui-backend",
  ghcrFrontendUrl:
    import.meta.env.VITE_GHCR_FRONTEND_URL ??
    "https://github.com/MrRagga-/yealink-contacts-ui/pkgs/container/yealink-contacts-ui-frontend",
  dockerHubUrl: import.meta.env.VITE_DOCKERHUB_URL ?? "https://hub.docker.com/r/mrragga/yealink-contacts-ui",
  supportUrl: import.meta.env.VITE_SUPPORT_URL ?? "https://github.com/MrRagga-/yealink-contacts-ui/blob/main/SUPPORT.md",
  licenseName: "Apache-2.0",
} as const;
