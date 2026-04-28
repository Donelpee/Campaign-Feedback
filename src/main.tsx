import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabaseConfigError } from "./integrations/supabase/client";
import { ConfigErrorScreen } from "./components/ConfigErrorScreen";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    {supabaseConfigError ? <ConfigErrorScreen message={supabaseConfigError} /> : <App />}
  </AppErrorBoundary>,
);
