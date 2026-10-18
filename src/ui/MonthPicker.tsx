import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth } from "./dates";
import { localDate } from "../domain";

export function MonthPicker({
  value,
  onChange,
  allowAll = false,
  label = "Choose month",
}: {
  value: string;
  onChange: (month: string) => void;
  allowAll?: boolean;
  label?: string;
}) {
  const base = value === "all" ? localDate().slice(0, 7) : value;
  return (
    <div className="period-control">
      <div className="month-picker">
        <button
          onClick={() => onChange(shiftMonth(base, -1))}
          className="icon-button"
          aria-label="Previous month"
        >
          <ChevronLeft size={17} />
        </button>
        <label>
          <span className="sr-only">{label}</span>
          <input
            aria-label={label}
            type="month"
            value={value === "all" ? "" : value}
            onChange={(event) =>
              event.target.value && onChange(event.target.value)
            }
          />
          <span>{value === "all" ? "All time" : monthLabel(value, true)}</span>
        </label>
        <button
          onClick={() => onChange(shiftMonth(base, 1))}
          className="icon-button"
          aria-label="Next month"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      {allowAll && (
        <button
          className={`period-all ${value === "all" ? "selected" : ""}`}
          aria-pressed={value === "all"}
          onClick={() =>
            onChange(value === "all" ? localDate().slice(0, 7) : "all")
          }
        >
          {value === "all" ? "This month" : "All time"}
        </button>
      )}
    </div>
  );
}
