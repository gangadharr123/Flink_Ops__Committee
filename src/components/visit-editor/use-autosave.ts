"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { saveVisit } from "@/app/(app)/visits/actions";
import {
  buildPatch,
  isPatchEmpty,
  type VisitFormValues,
  type VisitStep,
} from "@/lib/visit-form";

export type SaveStatus =
  | "saved" // everything is on the server ("Synced")
  | "unsaved" // changes waiting for the next save
  | "saving"
  | "local" // offline: changes are kept on this phone, sync when back online
  | "error" // the server refused the save, retrying
  | "incomplete"; // something can't be saved yet (bad score, card without role)

const SAVE_DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;

// Unsaved changes are also kept on the phone (localStorage), so nothing is
// lost if signal drops or the browser closes the tab.
function backupKey(visitId: string) {
  return `hubcheck:visit:${visitId}`;
}

export function readBackup(visitId: string): VisitFormValues | null {
  try {
    const raw = localStorage.getItem(backupKey(visitId));
    return raw ? (JSON.parse(raw).values as VisitFormValues) : null;
  } catch {
    return null;
  }
}

export function clearBackup(visitId: string) {
  try {
    localStorage.removeItem(backupKey(visitId));
  } catch {
    // storage blocked (private mode): nothing to clear
  }
}

function writeBackup(visitId: string, values: VisitFormValues) {
  try {
    localStorage.setItem(
      backupKey(visitId),
      JSON.stringify({ values, at: new Date().toISOString() }),
    );
  } catch {
    // storage full or blocked: autosave to the server still works
  }
}

// The saving logic, kept outside React so it is easy to follow:
// changes -> wait 2 s -> send only what changed -> on failure retry in 5 s.
// Offline: changes stay in localStorage ("local") and are sent as soon as
// the browser reports it is back online. Only one save runs at a time.
class Autosaver {
  status: SaveStatus = "saved";
  lastError: string | null = null;
  private saved: VisitFormValues;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<boolean> | null = null;

  constructor(
    private visitId: string,
    private shelfIds: Record<string, string>,
    initial: VisitFormValues,
    private getValues: () => VisitFormValues,
    private onStatus: (status: SaveStatus, error: string | null) => void,
  ) {
    this.saved = structuredClone(initial);
  }

  private setStatus(status: SaveStatus, error: string | null = null) {
    this.status = status;
    this.lastError = error;
    this.onStatus(status, error);
  }

  changed(values: VisitFormValues) {
    writeBackup(this.visitId, values);
    if (!navigator.onLine) {
      // No point trying: wait for the "online" event.
      clearTimeout(this.timer);
      this.setStatus("local");
      return;
    }
    if (this.status !== "saving") this.setStatus("unsaved");
    this.schedule(SAVE_DELAY_MS);
  }

  // Browser events from the hook below.
  wentOffline() {
    clearTimeout(this.timer);
    if (this.status !== "saved") this.setStatus("local");
  }

  backOnline() {
    void this.saveNow();
  }

  private schedule(delay: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.saveNow(), delay);
  }

  // Save right away. Resolves true when everything sendable is saved.
  async saveNow(extra?: { current_step?: VisitStep }): Promise<boolean> {
    clearTimeout(this.timer);
    while (this.inFlight) await this.inFlight;
    this.inFlight = this.runSave(extra);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async runSave(extra?: { current_step?: VisitStep }) {
    const { patch, next, skipped } = buildPatch(
      this.saved,
      this.getValues(),
      this.shelfIds,
    );
    if (extra?.current_step) {
      patch.visit = { ...patch.visit, current_step: extra.current_step };
    }
    if (isPatchEmpty(patch)) {
      this.settle(skipped);
      return true;
    }

    if (!navigator.onLine) {
      this.setStatus("local");
      return false;
    }

    this.setStatus("saving");
    let error: string | null;
    try {
      error = (await saveVisit(this.visitId, patch)).error ?? null;
    } catch {
      // The request didn't get through (e.g. Wi-Fi with no internet). The
      // changes are already in localStorage, so this is "saved locally".
      this.setStatus("local");
      this.schedule(RETRY_DELAY_MS);
      return false;
    }
    if (error) {
      this.setStatus("error", error);
      this.schedule(RETRY_DELAY_MS);
      return false;
    }

    this.saved = next;
    // The user may have kept typing while we were saving.
    const after = buildPatch(this.saved, this.getValues(), this.shelfIds);
    if (isPatchEmpty(after.patch)) {
      this.settle(after.skipped);
    } else {
      this.setStatus("unsaved");
      this.schedule(SAVE_DELAY_MS);
    }
    return true;
  }

  private settle(skipped: number) {
    if (skipped > 0) {
      this.setStatus("incomplete");
    } else {
      this.setStatus("saved");
      clearBackup(this.visitId);
    }
  }

  dispose() {
    clearTimeout(this.timer);
  }
}

export function useAutosave({
  form,
  visitId,
  shelfIds,
  initial,
  enabled,
}: {
  form: UseFormReturn<VisitFormValues>;
  visitId: string;
  shelfIds: Record<string, string>;
  initial: VisitFormValues;
  enabled: boolean;
}) {
  const [{ status, error }, setState] = useState<{
    status: SaveStatus;
    error: string | null;
  }>({ status: "saved", error: null });

  // Created once per editor; useState's initializer runs only on first render.
  const [saver] = useState(
    () =>
      new Autosaver(visitId, shelfIds, initial, form.getValues, (s, e) =>
        setState({ status: s, error: e }),
      ),
  );

  useEffect(() => {
    if (!enabled) return;
    // Every form change marks the visit unsaved and schedules a save.
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => saver.changed(values),
    });

    // Save when the phone locks or the app goes to the background.
    const onHide = () => {
      if (document.visibilityState === "hidden") void saver.saveNow();
    };
    // Warn before closing the tab with unsaved changes.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saver.status !== "saved") event.preventDefault();
    };
    // Airplane mode on/off: switch to "saved on this phone", and sync the
    // moment the connection is back.
    const onOffline = () => saver.wentOffline();
    const onOnline = () => saver.backOnline();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // Opened while offline, or with changes restored from this phone.
    if (!navigator.onLine) saver.wentOffline();

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      saver.dispose();
    };
  }, [enabled, form, saver]);

  return {
    status,
    error,
    saveNow: (extra?: { current_step?: VisitStep }) =>
      enabled ? saver.saveNow(extra) : Promise.resolve(true),
  };
}
