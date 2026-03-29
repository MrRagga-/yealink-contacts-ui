import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { ToastProvider } from "./hooks/useToast";
import { I18nProvider } from "./lib/i18n";
import { queryClient } from "./lib/queryClient";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
