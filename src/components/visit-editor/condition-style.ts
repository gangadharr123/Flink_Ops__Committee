import type { Condition } from "@/lib/visit-form";

// Colour of a selected condition chip: green is good, red is mould.
export function conditionClass(condition: Condition) {
  switch (condition) {
    case "clean":
      return "border-emerald-600 bg-emerald-600 text-white";
    case "minor_dust":
      return "border-amber-300 bg-amber-300 text-amber-950";
    case "dusty":
      return "border-amber-600 bg-amber-600 text-white";
    case "mould":
      return "border-red-600 bg-red-600 text-white";
    case "damaged":
      return "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900";
  }
}
