import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabaseConfigError } from "./integrations/supabase/client";
import { ConfigErrorScreen } from "./components/ConfigErrorScreen";

createRoot(document.getElementById("root")!).render(
  supabaseConfigError ? <ConfigErrorScreen message={supabaseConfigError} /> : <App />,
);
