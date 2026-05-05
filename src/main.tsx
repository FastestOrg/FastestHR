import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPerformanceMonitoring } from "./lib/performance";

// Initialize state-of-the-art performance monitoring
initPerformanceMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
