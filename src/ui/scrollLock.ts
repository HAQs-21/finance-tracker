// Sheets can overlap during exit/entry. One shared owner set prevents a departing
// sheet from restoring another sheet's "hidden" snapshot after it has closed.
const owners = new Set<symbol>();
let previous = "";
export function lockScroll(): () => void {
  const owner = Symbol();
  if (!owners.size) previous = document.body.style.overflow;
  owners.add(owner);
  document.body.style.overflow = "hidden";
  return () => {
    if (!owners.delete(owner)) return;
    if (!owners.size) document.body.style.overflow = previous;
  };
}
