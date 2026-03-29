import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "de";

const STORAGE_KEY = "yealink-contacts-ui.locale";

const messages = {
  en: {
    appTitle: "Yealink Contacts Sync",
    appTagline: "Local sync tool for Yealink remote phonebooks",
    dashboard: "Dashboard",
    sources: "Sources",
    contacts: "Contacts",
    rules: "Rules",
    exports: "Export / Yealink",
    jobs: "Jobs / Logs",
    settings: "Settings",
    about: "About",
    language: "Language",
    english: "English",
    german: "German",
    settingsEyebrow: "Defaults",
    settingsTitle: "Application settings",
    settingsSection: "Defaults for new items",
    aboutEyebrow: "Project",
    aboutTitle: "About this project",
    aboutSummary:
      "Project metadata, release model, registry links, and support entry points for the open-source repository.",
    version: "Version",
    releaseModel: "Release model",
    repository: "GitHub repository",
    issues: "Issues",
    containers: "Container images",
    license: "License",
    support: "Support",
  },
  de: {
    appTitle: "Yealink Contacts Sync",
    appTagline: "Lokales Sync-Tool für Yealink-Remote-Phonebooks",
    dashboard: "Dashboard",
    sources: "Quellen",
    contacts: "Kontakte",
    rules: "Regeln",
    exports: "Export / Yealink",
    jobs: "Jobs / Logs",
    settings: "Einstellungen",
    about: "Über",
    language: "Sprache",
    english: "Englisch",
    german: "Deutsch",
    settingsEyebrow: "Standards",
    settingsTitle: "Anwendungseinstellungen",
    settingsSection: "Standardwerte für neue Einträge",
    aboutEyebrow: "Projekt",
    aboutTitle: "Über dieses Projekt",
    aboutSummary:
      "Projektmetadaten, Release-Modell, Registry-Links und Support-Einstiegspunkte für das Open-Source-Repository.",
    version: "Version",
    releaseModel: "Release-Modell",
    repository: "GitHub-Repository",
    issues: "Issues",
    containers: "Container-Images",
    license: "Lizenz",
    support: "Support",
  },
} as const;

type MessageKey = keyof typeof messages.en;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "de") {
    return stored;
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale(nextLocale) {
        setLocaleState(nextLocale);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, nextLocale);
        }
      },
      t(key) {
        return messages[locale][key];
      },
    }),
    [locale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}

export function t(key: MessageKey): string {
  return messages.en[key];
}
