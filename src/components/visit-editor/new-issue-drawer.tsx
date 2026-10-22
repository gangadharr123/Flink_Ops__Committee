"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createIssue } from "@/app/(app)/visits/actions";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { severityTone } from "@/components/state";
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
import { removeUploadedPhoto, uploadVisitPhoto } from "@/lib/upload-photo";
import type { NewIssue } from "@/lib/visits";
import { ChoiceChips } from "./choice-chips";


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
  // The compressed photo and a local preview link for it.
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSave = category !== "" && title.trim().length >= 3 && severity !== null;

  function reset() {
    setCategory("");
    setTitle("");
    setSeverity(null);
    setDescription("");
    setPhoto(null);
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
      // 1. Upload the photo straight from the phone to Storage.
      let photoPath: string | undefined;
      if (chosen) {
        try {
          photoPath = await uploadVisitPhoto(visitId, chosen.blob);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Photo upload failed.");
          return;
        }
      }

      // 2. Create the issue and link the photo.
      const result = await createIssue(visitId, { ...input, photoPath });
      if (!result.issue) {
        if (photoPath) await removeUploadedPhoto(photoPath).catch(() => {});
        setError(result.error ?? "Could not add the issue.");
        return;
      }
      const photoId = result.issue.photoId;
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
        photos: photoId && chosen ? [{ id: photoId, url: chosen.preview, caption: null }] : [],
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
                className="h-12 rounded-lg border border-input bg-background px-4 text-base"
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
                tone={severityTone}
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
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the compressed photo */}
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
                <PhotoPicker onPicked={setPhoto} />
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DrawerFooter className="pb-[calc(max(1rem,env(safe-area-inset-bottom))+var(--badge-clearance))]">
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
