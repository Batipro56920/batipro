import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  let reloading = false;
  let visibilityListenerAttached = false;

  const reloadApp = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", reloadApp);

  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => {
          void updateSW(true);
        },
        onRegisteredSW: (_swUrl, registration) => {
          if (!registration) return;

          const checkForUpdates = () => {
            void registration.update().catch(() => {
              // Ignore update polling errors.
            });
          };

          window.setTimeout(checkForUpdates, 15_000);
          window.setInterval(checkForUpdates, 60_000);

          if (!visibilityListenerAttached) {
            visibilityListenerAttached = true;
            document.addEventListener("visibilitychange", () => {
              if (document.visibilityState === "visible") checkForUpdates();
            });
          }
        },
      });
    })
    .catch(() => {
      // Ignore service worker registration errors.
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);


