import { cn } from "../../../lib/cn.js";
import { HISTORY_FILTER_FIELDS } from "../hero-history-labels.js";

interface HeroHistoryFieldFilterProps {
  value: string | undefined;
  onChange: (field: string | undefined) => void;
  counts: Record<string, number>;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

export function HeroHistoryFieldFilter({
  value,
  onChange,
  counts,
}: HeroHistoryFieldFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar por campo alterado"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
    >
      <FilterChip
        label="Todos"
        count={sumCounts(counts)}
        selected={value === undefined}
        onClick={() => {
          onChange(undefined);
        }}
      />
      {HISTORY_FILTER_FIELDS.map(({ field, label }) => (
        <FilterChip
          key={field}
          label={label}
          count={counts[field] ?? 0}
          selected={value === field}
          onClick={() => {
            onChange(field);
          }}
        />
      ))}
    </div>
  );
}

function FilterChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition",
        selected
          ? "border-primary bg-primary text-white"
          : "border-border bg-white text-gray-700 hover:bg-gray-50",
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs",
          selected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}
