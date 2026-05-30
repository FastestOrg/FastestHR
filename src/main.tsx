import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPerformanceMonitoring } from "./lib/performance";
import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_POSTHOG_PROJECT_TOKEN, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  defaults: '2026-01-30',
});

// Initialize state-of-the-art performance monitoring
initPerformanceMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
