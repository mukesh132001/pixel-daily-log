// Date helpers and the four-week window the calendar shows.

export const pad = n => String(n).padStart(2, "0");

// "2026-10-20" style key, in the visitor's local time.
export const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fmt = d => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
export const TODAY_K = key(TODAY);

// 28 days: the current week plus the three before it, starting on a Monday.
const monday = new Date(TODAY);
monday.setDate(TODAY.getDate() - ((TODAY.getDay() + 6) % 7) - 21);
export const DAYS = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(monday);
  d.setDate(monday.getDate() + i);
  return d;
});
