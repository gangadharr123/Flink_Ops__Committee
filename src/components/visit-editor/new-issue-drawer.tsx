"use client";

import { useState, useTransition } from "react";
import { Camera, X } from "lucide-react";
import { createIssue } from "@/app/(app)/visits/actions";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_LABELS,
  SEVERITIES,
  type IssueCategory,
  type Severity,
} from "@/lib/issues";
import { resizeImage } from "@/lib/resize-image";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";
import type { NewIssue } from "@/lib/visits";
import { ChoiceChips } from "./choice-chips";

const severityClass = (s: Severity) =>
  s === "immediate"
    ? "border-red-600 bg-red-600 font-bold text-white"
    : s === "high"
      ? "border-orange-500 bg-orange-500 text-white"
      : s === "medium"
        ? "border-amber-500 bg-amber-500 text-white"
        : "border-primary bg-primary text-primary-foreground";

// Bottom sheet for a new issue. Saved straight away (not autosaved).
export function NewIssueDrawer({
  visitId,
  open,
  onOpenChange,
  onCreated,
}: {
  visitId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (issue: NewIssue) => void;
}) {
  const [category, setCategory] = useState<IssueCategory | "">("");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [description, setDescription] = useState("");
  // The resized photo and a local preview link for it.
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSave =
    category !== "" && title.trim().length >= 3 && severity !== null && !preparing;

  function reset() {
    setCategory("");
    setTitle("");
    setSeverity(null);
    setDescription("");
    setPhoto(null);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const blob = await resizeImage(file);
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the photo.");
    } finally {
      setPreparing(false);
    }
  }

  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
  }

  function save() {
    if (category === "" || severity === null || !canSave) return;
    // Captured after the checks above, so the types know they're set.
    const input = { category, title, severity, description };
    const chosen = photo;
    setError(null);
    startTransition(async () => {
      // 1. Upload the photo straight from the phone to Storage. The storage
      //    rules only accept it inside a draft visit's folder.
      const supabase = createBrowserSupabase();
      let photoPath: string | undefined;
      if (chosen) {
        photoPath = `${visitId}/${uuid()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("visit-photos")
          .upload(photoPath, chosen.blob, { contentType: "image/jpeg" });
        if (uploadError) {
          setError("Photo upload failed. Check your connection and try again.");
          return;
        }
      }

      // 2. Create the issue and link the photo.
      const result = await createIssue(visitId, { ...input, photoPath });
      if (!result.issue) {
        if (photoPath) await supabase.storage.from("visit-photos").remove([photoPath]);
        setError(result.error ?? "Could not add the issue.");
        return;
      }
      const photoLinked = Boolean(chosen && !result.error);
      onCreated({
        id: result.issue.id,
        key: result.issue.key,
        title: input.title.trim(),
        category: input.category,
        severity: input.severity,
        description: input.description.trim() || null,
        excluded: false,
        visitsSeen: 1,
        isRecurring: false,
        photos:
          photoLinked && chosen
            ? [{ id: photoPath!, url: chosen.preview, caption: null }]
            : [],
      });
      reset();
      // Saved, but the photo didn't attach: keep the sheet open to say so.
      if (result.error) setError(result.error);
      else onOpenChange(false);
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-lg flex-col overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Add new issue</DrawerTitle>
            <DrawerDescription>First seen on this visit.</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-category">Category</Label>
              {/* A native select opens the phone's own picker: easy one-handed. */}
              <select
                id="issue-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as IssueCategory)}
                className="h-12 rounded-lg border border-input bg-background px-3 text-base"
              >
                <option value="" disabled>
                  Choose...
                </option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fridge 13 door handle broken"
                className="h-12 text-base"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Severity</span>
              <ChoiceChips
                label="Severity"
                options={SEVERITIES}
                value={severity}
                onChange={setSeverity}
                className="grid-cols-4"
                selectedClassName={severityClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="issue-description">Description (optional)</Label>
              <Textarea
                id="issue-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What, where, since when?"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Photo (optional)</span>
              {photo ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the resized photo */}
                  <img
                    src={photo.preview}
                    alt="Selected photo"
                    className="size-24 rounded-lg border object-cover"
                  />
                  <Button type="button" variant="ghost" onClick={removePhoto} className="h-11">
                    <X /> Remove
                  </Button>
                </div>
              ) : (
                // The label opens the phone's camera / photo library picker.
                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-base hover:bg-muted">
                  <Camera className="size-5" />
                  {preparing ? "Preparing photo..." : "Take or choose photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={preparing}
                    onChange={(e) => {
                      void pickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              onClick={save}
              disabled={!canSave || pending}
              className="h-12 text-base"
            >
              {pending ? "Saving..." : "Save issue"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 text-base"
            >
              Cancel
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
