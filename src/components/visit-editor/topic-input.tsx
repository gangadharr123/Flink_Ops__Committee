"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeTag } from "@/lib/visit-form";

const MAX_SUGGESTIONS = 10;
const show = (tag: string) => tag.replaceAll("_", " ");

// Tag picker: chosen tags as removable chips, a text box for new ones, and
// tappable suggestions from earlier visits that match what you type.
export function TopicInput({
  value,
  onChange,
  suggestions,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const query = normalizeTag(text);

  const matching = suggestions
    .filter((tag) => !value.includes(tag) && (query === "" || tag.includes(query)))
    .slice(0, MAX_SUGGESTIONS);

  function add(raw: string) {
    const tag = normalizeTag(raw);
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setText("");
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex h-9 items-center gap-1 rounded-full bg-primary pr-1 pl-3 text-sm text-primary-foreground">
                {show(tag)}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((t) => t !== tag))}
                    aria-label={`Remove ${show(tag)}`}
                    className="flex size-7 items-center justify-center rounded-full hover:bg-primary-foreground/20"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  add(text);
                }
              }}
              placeholder="Type a topic, e.g. fridge doors"
              autoComplete="off"
              enterKeyHint="done"
              aria-label="New topic"
              className="h-11 text-base"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => add(text)}
              disabled={query === ""}
              aria-label="Add topic"
              className="size-11"
            >
              <Plus />
            </Button>
          </div>
          {matching.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Suggested topics">
              {matching.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => add(tag)}
                    className="inline-flex h-9 items-center rounded-full border px-3 text-sm hover:bg-muted"
                  >
                    + {show(tag)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
