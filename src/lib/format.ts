// Formats a date-only string ("2026-10-20") as "20 Oct 2026".
// Date-only values have no time zone, so format them in UTC to avoid
// showing the day before.
export function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Today's date in Germany as "YYYY-MM-DD" (the server runs in UTC).
export function todayInGermany() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
}
