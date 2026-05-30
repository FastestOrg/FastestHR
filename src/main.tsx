import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPerformanceMonitoring } from "./lib/performance";
import posthog from 'posthog-js';

async function bootstrap() {
  let token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
  let host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  // If no environment variable is provided, fetch dynamically from Supabase Secrets
  if (!token) {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-posthog-config`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }
      });
      if (response.ok) {
        const data = await response.json();
        token = data.token;
        host = data.host || host;
      } else {
        console.warn("Could not retrieve PostHog config from Supabase Edge Function.");
      }
    } catch (e) {
      console.error("Failed to fetch PostHog config from Supabase Edge Secrets:", e);
    }
  }

  if (token) {
    posthog.init(token, {
      api_host: host,
      defaults: '2026-01-30',
      enable_recording_console_log: true, // Captures console logs inside session replays (vital for finding/fixing issues)
      capture_performance: true,         // Captures performance metrics & network request timings
    });
  } else {
    console.warn("PostHog initialization skipped: No Project Token found.");
  }

  // Initialize state-of-the-art performance monitoring
  initPerformanceMonitoring();

  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
