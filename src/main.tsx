import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.tsx";
import { AppDialogProvider } from "./app/components/ui/app-dialog.tsx";
import { AppErrorBoundary } from "./app/components/layout/AppErrorBoundary.tsx";
import { getRouterBasename } from "./app/routes";
import "./styles/index.css";

import { warnProductionConfigIssues } from "./app/config/productionGuard";

warnProductionConfigIssues();

/** PWA: registrar service worker solo en producción (Hostinger / preview build). */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <BrowserRouter basename={getRouterBasename()}>
      <AppDialogProvider>
        <App />
      </AppDialogProvider>
    </BrowserRouter>
  </AppErrorBoundary>
);
  