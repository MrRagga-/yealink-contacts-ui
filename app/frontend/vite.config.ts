import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { ProxyOptions } from "vite";

type ProxyRequest = {
  setHeader: (name: string, value: string) => void;
};

type ProxyAwareRequest = {
  headers: Record<string, string | string[] | undefined>;
  socket: {
    remoteAddress?: string;
  };
};

type ProxyWithEvents = {
  on: (
    event: "proxyReq",
    listener: (proxyReq: ProxyRequest, req: ProxyAwareRequest) => void,
  ) => void;
};

function withForwardedClientIp(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    configure: (proxy) => {
      (proxy as unknown as ProxyWithEvents).on("proxyReq", (proxyReq, req) => {
        const remoteAddress = req.socket.remoteAddress;
        if (!remoteAddress) {
          return;
        }

        const existingForwardedFor = req.headers["x-forwarded-for"];
        const forwardedFor = Array.isArray(existingForwardedFor)
          ? [...existingForwardedFor, remoteAddress].join(", ")
          : existingForwardedFor
            ? `${existingForwardedFor}, ${remoteAddress}`
            : remoteAddress;

        proxyReq.setHeader("X-Forwarded-For", forwardedFor);
        proxyReq.setHeader("X-Real-IP", remoteAddress);
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": withForwardedClientIp("http://127.0.0.1:8000"),
      "/healthz": withForwardedClientIp("http://127.0.0.1:8000"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
    globals: true,
  },
});
