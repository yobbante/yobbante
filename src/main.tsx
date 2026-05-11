import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAnalytics } from "./lib/analytics";

// Install GTM as early as possible so the container loads on first paint.
// No-op when VITE_GTM_ID is not configured (dev / preview without secret).
installAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
