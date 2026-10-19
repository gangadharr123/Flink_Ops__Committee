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
  | "saved" // everything is on the server
  | "unsaved" // changes waiting for the next save
  | "saving"
  | "error" // last save failed, retrying
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
// Only one save runs at a time.
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
    if (this.status !== "saving") this.setStatus("unsaved");
    this.schedule(SAVE_DELAY_MS);
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

    this.setStatus("saving");
    let error: string | null;
    try {
      error = (await saveVisit(this.visitId, patch)).error ?? null;
    } catch {
      error = "No connection. Will retry.";
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
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
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
