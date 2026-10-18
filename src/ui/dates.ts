const longMonth = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});
const shortMonth = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "numeric",
});
const dayFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dates = new Map<string, string>();
export function monthLabel(month: string, short = false) {
  return (short ? shortMonth : longMonth).format(
    new Date(`${month}-01T12:00:00`),
  );
}
export function shiftMonth(month: string, offset: number) {
  const d = new Date(`${month}-01T12:00:00`);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function dateLabel(date: string) {
  let label = dates.get(date);
  if (!label) {
    label = dayFormat.format(new Date(`${date}T12:00:00`));
    if (dates.size >= 512) dates.clear();
    dates.set(date, label);
  }
  return label;
}
