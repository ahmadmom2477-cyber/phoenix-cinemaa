import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress cross-origin iframe errors (e.g. from embedded video players like vidsrc).
// These appear as "Script error." or unknown runtime errors with no filename/stack
// because the browser masks details from cross-origin scripts.
// They are harmless to the app and should never trigger the dev error overlay.
window.addEventListener("error", (event) => {
  const isCrossOrigin =
    !event.filename ||
    event.filename === "" ||
    event.error === null ||
    event.message === "Script error." ||
    event.message === "";
  if (isCrossOrigin) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}, true);

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const isCrossOrigin =
    !reason ||
    (typeof reason === "object" && !reason.stack && !reason.message);
  if (isCrossOrigin) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}, true);

if ("serviceWorker" in navigator) {
  const basePath = import.meta.env.BASE_URL ?? "/";
  const swUrl = `${basePath}adblock-sw.js`.replace(/\/+/g, "/");

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swUrl, { scope: basePath })
      .catch(() => {
        // Service worker registration failed silently — app still works
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
