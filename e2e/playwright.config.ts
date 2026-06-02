import { defineConfig, devices } from "@playwright/test";

const backendPort = process.env.E2E_BACKEND_PORT ?? "8000";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "5173";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${frontendPort}`;

const backendEnv = {
  APP_ENV: "development",
  FRONTEND_ORIGIN: baseURL,
  WEBAUTHN_RP_ID: "localhost",
  WEBAUTHN_RP_ORIGIN: baseURL,
  DATABASE_URL: "sqlite:///./e2e_yealink_contacts.db",
  APP_SECRET_KEY: process.env.APP_SECRET_KEY ?? "e2e-dev-secret-key-change-me",
  ENCRYPTION_KEY:
    process.env.ENCRYPTION_KEY ?? "S4aexYnjREGeQkSQIlPCXSQLgXUhY_GfJ1i1n1a34zg=",
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: `cd ../app/backend && rm -f e2e_yealink_contacts.db e2e_yealink_contacts.db-wal e2e_yealink_contacts.db-shm && uv run uvicorn yealink_contacts.main:app --host 127.0.0.1 --port ${backendPort}`,
      url: `http://127.0.0.1:${backendPort}/healthz`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: backendEnv,
    },
    {
      command: `cd ../app/frontend && npm run dev -- --host localhost --port ${frontendPort}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
