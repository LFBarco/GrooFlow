import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.tsx";
import { AppErrorBoundary } from "./app/components/layout/AppErrorBoundary.tsx";
import { getRouterBasename } from "./app/routes";
import "./styles/index.css";

import { warnProductionConfigIssues } from "./app/config/productionGuard";

warnProductionConfigIssues();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <BrowserRouter basename={getRouterBasename()}>
      <App />
    </BrowserRouter>
  </AppErrorBoundary>
);
  