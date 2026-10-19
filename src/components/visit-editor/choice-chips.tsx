"use client";

import { cn } from "@/lib/utils";

// A row of big tap-friendly buttons where one can be selected
// (used for condition, staff role, manager present, yes/no).
// Tapping the selected chip again clears it when allowClear is set.
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  disabled,
  allowClear = false,
  label,
  className,
  selectedClassName,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
  label: string;
  className?: string;
  // per-value colour for the selected state, e.g. red for mould
  selectedClassName?: (value: T) => string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("grid gap-1.5", className)}>
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
              "flex min-h-11 items-center justify-center rounded-lg border px-1 text-center text-xs leading-tight font-medium transition-colors disabled:cursor-default sm:text-sm",
              selected
                ? (selectedClassName?.(option.value) ??
                    "border-primary bg-primary text-primary-foreground")
                : "bg-background enabled:hover:bg-muted",
              disabled && !selected && "opacity-60",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
