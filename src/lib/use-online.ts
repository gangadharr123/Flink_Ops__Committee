"use client";

import { useSyncExternalStore } from "react";

// true/false as the browser reports it; changes when airplane mode or
// Wi-Fi switches. The server always assumes online.
// (navigator.onLine can say "online" on a network with no internet; autosave
// still treats a failed save as offline, so nothing is lost.)
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
