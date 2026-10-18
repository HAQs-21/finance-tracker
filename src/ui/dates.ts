export function monthLabel(month: string, short = false) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en", {
    month: short ? "short" : "long",
    year: "numeric",
  });
}
export function shiftMonth(month: string, offset: number) {
  const d = new Date(`${month}-01T12:00:00`);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
