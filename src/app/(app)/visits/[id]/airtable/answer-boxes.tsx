"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AIRTABLE_FIELDS, type AirtableAnswers, type AirtableField } from "@/lib/airtable/answers";
import { saveAirtableAnswer } from "./actions";

const SAVE_DELAY_MS = 1200;

export function AnswerBoxes({
  visitId,
  generated,
  edited,
  canEdit,
}: {
  visitId: string;
  generated: AirtableAnswers;
  edited: Partial<AirtableAnswers>;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {AIRTABLE_FIELDS.map((field) => (
        <AnswerBox
          key={field.key}
          visitId={visitId}
          field={field.key}
          label={field.label}
          generated={generated[field.key]}
          initial={edited[field.key]}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}

type Status = "idle" | "saving" | "saved" | "error";

// One Airtable field: text box, Copy, and (when edited) Reset.
// Edits save 1.2 s after you stop typing, and when you leave the box.
function AnswerBox({
  visitId,
  field,
  label,
  generated,
  initial,
  canEdit,
}: {
  visitId: string;
  field: AirtableField;
  label: string;
  generated: string;
  initial: string | undefined;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initial ?? generated);
  const [savedValue, setSavedValue] = useState(initial ?? generated);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const id = `answer-${field}`;

  useEffect(() => () => clearTimeout(timer.current), []);

  async function save(text: string) {
    clearTimeout(timer.current);
    if (text === savedValue) return;
    setStatus("saving");
    // Same as the generated text = not an edit, so store nothing.
    const result = await saveAirtableAnswer(visitId, field, text === generated ? null : text);
    if (result.error) {
      setStatus("error");
      setError(result.error);
    } else {
      setSavedValue(text);
      setStatus("saved");
      setError(null);
    }
  }

  function change(text: string) {
    setValue(text);
    setStatus("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(text), SAVE_DELAY_MS);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // The clipboard API needs https; fall back to selecting the text.
      textarea.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setValue(generated);
    void save(generated);
  }

  const isEdited = value !== generated;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor={id} className="text-base font-semibold">
          {label}
        </Label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {status === "saving" && "Saving..."}
          {status === "saved" && "Saved"}
          {status === "error" && <span className="text-destructive">{error}</span>}
          {status === "idle" && isEdited && "Edited"}
        </span>
      </div>
      <Textarea
        ref={textarea}
        id={id}
        value={value}
        readOnly={!canEdit}
        onChange={(e) => change(e.target.value)}
        onBlur={() => canEdit && void save(value)}
        className="min-h-32 text-base leading-relaxed"
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={copy} className="h-11 flex-1 text-base sm:flex-none sm:px-6">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {canEdit && isEdited && (
          <Button type="button" variant="outline" onClick={reset} className="h-11">
            <RotateCcw /> Reset to generated
          </Button>
        )}
      </div>
    </section>
  );
}
