"use client";

import { useEffect } from "react";

// Registers public/sw.js (offline support). Production only: in
// `npm run dev` a service worker would serve stale files and fight with
// hot reloading.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);
  return null;
}
