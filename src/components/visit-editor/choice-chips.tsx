"use client";

import { StateDot, type Tone } from "@/components/state";
import { cn } from "@/lib/utils";

// A row of tap-friendly options where one can be selected (condition,
// staff role, manager present, yes/no...). The selected chip gets a dark
// border and bold text, plus a small coloured dot when the value is a state
// (tone). Tapping the selected chip again clears it when allowClear is set.
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  disabled,
  allowClear = false,
  label,
  className,
  tone,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
  label: string;
  className?: string;
  tone?: (value: T) => Tone;
}) {
  return (
    <div role="group" aria-label={label} className={cn("grid gap-2", className)}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(selected && allowClear ? null : option.value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 text-center text-sm leading-tight transition-colors disabled:cursor-default",
              selected
                ? "border-foreground font-medium text-foreground"
                : "text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground",
              disabled && !selected && "opacity-60",
            )}
          >
            {selected && tone && <StateDot tone={tone(option.value)} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
