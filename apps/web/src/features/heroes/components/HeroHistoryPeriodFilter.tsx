import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "../../../lib/cn.js";
import {
  addDaysToDateInputValue,
  formatDateInputValueShort,
  startOfMonthAsDateInputValue,
  todayAsDateInputValue,
} from "../../../lib/dates.js";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

interface Shortcut {
  label: string;
  getRange: () => { from: string; to: string };
}

const SHORTCUTS: Shortcut[] = [
  {
    label: "Hoje",
    getRange: () => {
      const today = todayAsDateInputValue();
      return { from: today, to: today };
    },
  },
  {
    label: "Últimos 7 dias",
    getRange: () => {
      const today = todayAsDateInputValue();
      return { from: addDaysToDateInputValue(today, -6), to: today };
    },
  },
  {
    label: "Últimos 30 dias",
    getRange: () => {
      const today = todayAsDateInputValue();
      return { from: addDaysToDateInputValue(today, -29), to: today };
    },
  },
  {
    label: "Este mês",
    getRange: () => ({
      from: startOfMonthAsDateInputValue(),
      to: todayAsDateInputValue(),
    }),
  },
];

function parseDateInputValue(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
}

function buildDateInputValue(year: number, month: number, day: number) {
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${String(year)}-${paddedMonth}-${paddedDay}`;
}

interface CalendarCell {
  value: string;
  day: number;
  inCurrentMonth: boolean;
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  const startWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPreviousMonth = new Date(year, month - 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const trailingDays = totalCells - startWeekday - daysInMonth;

  const cells: CalendarCell[] = [];

  for (let i = 0; i < startWeekday; i += 1) {
    const day = daysInPreviousMonth - startWeekday + 1 + i;
    cells.push({
      value: buildDateInputValue(previous.year, previous.month, day),
      day,
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      value: buildDateInputValue(year, month, day),
      day,
      inCurrentMonth: true,
    });
  }

  for (let day = 1; day <= trailingDays; day += 1) {
    cells.push({
      value: buildDateInputValue(next.year, next.month, day),
      day,
      inCurrentMonth: false,
    });
  }

  return cells;
}

interface HeroHistoryPeriodFilterProps {
  from: string | undefined;
  to: string | undefined;
  presetLabel: string | undefined;
  onApply: (from: string, to: string, presetLabel?: string) => void;
  onClear: () => void;
}

export function HeroHistoryPeriodFilter({
  from,
  to,
  presetLabel,
  onApply,
  onClear,
}: HeroHistoryPeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const today = parseDateInputValue(todayAsDateInputValue());
  const [visibleYear, setVisibleYear] = useState(today.year);
  const [visibleMonth, setVisibleMonth] = useState(today.month);
  const [rangeStart, setRangeStart] = useState<string | undefined>(undefined);
  const [rangeEnd, setRangeEnd] = useState<string | undefined>(undefined);

  const isActive = from !== undefined && to !== undefined;
  const label = !isActive
    ? "Qualquer data"
    : (presetLabel ??
      `${formatDateInputValueShort(from)} – ${formatDateInputValueShort(to)}`);

  function resetSelection() {
    setRangeStart(undefined);
    setRangeEnd(undefined);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetSelection();
    }
  }

  function handleShortcutClick(shortcut: Shortcut) {
    const { from: shortcutFrom, to: shortcutTo } = shortcut.getRange();
    onApply(shortcutFrom, shortcutTo, shortcut.label);
    setOpen(false);
  }

  function handleDayClick(value: string) {
    if (rangeStart === undefined || rangeEnd !== undefined) {
      setRangeStart(value);
      setRangeEnd(undefined);
      return;
    }
    if (value < rangeStart) {
      setRangeStart(value);
      return;
    }
    setRangeEnd(value);
  }

  function handleApplyRange() {
    if (rangeStart === undefined || rangeEnd === undefined) return;
    onApply(rangeStart, rangeEnd);
    setOpen(false);
  }

  function goToPreviousMonth() {
    if (visibleMonth === 1) {
      setVisibleMonth(12);
      setVisibleYear((year) => year - 1);
    } else {
      setVisibleMonth((month) => month - 1);
    }
  }

  function goToNextMonth() {
    if (visibleMonth === 12) {
      setVisibleMonth(1);
      setVisibleYear((year) => year + 1);
    } else {
      setVisibleMonth((month) => month + 1);
    }
  }

  const cells = buildMonthGrid(visibleYear, visibleMonth);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm font-medium",
          isActive
            ? "border-primary bg-primary-soft text-primary"
            : "border-border bg-white text-gray-700",
        )}
      >
        <PopoverPrimitive.Trigger asChild>
          <button type="button" className="flex items-center gap-2 px-2 py-1">
            <CalendarIcon className="size-4" aria-hidden="true" />
            {label}
            {!isActive ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : null}
          </button>
        </PopoverPrimitive.Trigger>
        {isActive ? (
          <button
            type="button"
            aria-label="Limpar período"
            onClick={onClear}
            className="rounded-full p-1 hover:bg-primary/10"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 flex overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
        >
          <div className="flex w-40 shrink-0 flex-col gap-1 border-r border-border p-4">
            <p className="mb-1 text-xs font-semibold tracking-wide text-gray-400">
              ATALHOS
            </p>
            {SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => {
                  handleShortcutClick(shortcut);
                }}
                className="rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                {shortcut.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={goToPreviousMonth}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <p className="text-sm font-medium text-gray-900">
                {MONTH_LABELS[visibleMonth - 1]} {visibleYear}
              </p>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={goToNextMonth}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
              {WEEKDAY_LABELS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const inRange =
                  rangeStart !== undefined &&
                  rangeEnd !== undefined &&
                  cell.value >= rangeStart &&
                  cell.value <= rangeEnd;
                const isRangeEdge =
                  cell.value === rangeStart || cell.value === rangeEnd;

                return (
                  <button
                    key={cell.value}
                    type="button"
                    disabled={!cell.inCurrentMonth}
                    onClick={() => {
                      handleDayClick(cell.value);
                    }}
                    className={cn(
                      "rounded-full py-1.5 text-sm",
                      !cell.inCurrentMonth && "text-gray-300",
                      cell.inCurrentMonth && !inRange && "text-gray-900 hover:bg-gray-100",
                      inRange && !isRangeEdge && "bg-primary-soft text-primary",
                      isRangeEdge && "bg-primary text-white",
                    )}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <p className="text-sm text-gray-500">
                {rangeStart !== undefined && rangeEnd !== undefined
                  ? `${formatDateInputValueShort(rangeStart)} – ${formatDateInputValueShort(rangeEnd)}`
                  : "Selecione início e fim"}
              </p>
              <button
                type="button"
                disabled={rangeStart === undefined || rangeEnd === undefined}
                onClick={handleApplyRange}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
