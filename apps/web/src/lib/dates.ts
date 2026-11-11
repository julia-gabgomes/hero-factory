// `date_of_birth` é uma string "YYYY-MM-DD" sem hora. `new Date("YYYY-MM-DD")`
// interpreta a data como meia-noite UTC, que pode virar o dia anterior em
// fusos negativos — por isso toda formatação aqui manipula a string direto,
// nunca cria um Date a partir dela.
export function formatDateOfBirth(dateOfBirth: string): string {
  const [year, month, day] = dateOfBirth.split("-");
  return `${day}/${month}/${year}`;
}

export function todayAsDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

// Timestamps da API (ISO 8601 com Z) são inequívocos, então aqui `new Date`
// é seguro: o fuso do navegador entra só na exibição via Intl.
export function formatDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoTimestamp));
}

export function addDaysToDateInputValue(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(year, month - 1, day + days);
  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, "0");
  const resultDay = String(date.getDate()).padStart(2, "0");
  return `${String(resultYear)}-${resultMonth}-${resultDay}`;
}

export function startOfMonthAsDateInputValue(): string {
  const today = todayAsDateInputValue();
  const [year, month] = today.split("-");
  return `${year ?? ""}-${month ?? ""}-01`;
}

const MONTH_ABBREVIATIONS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function formatDateInputValueShort(value: string): string {
  const [, month, day] = value.split("-");
  const monthIndex = Number(month) - 1;
  return `${day ?? ""} ${MONTH_ABBREVIATIONS[monthIndex] ?? ""}`;
}

// Mesma garantia de `formatDateTime`: timestamp ISO 8601 com Z é inequívoco,
// então `new Date` aqui é seguro.
export function formatMissionDateTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[date.getMonth()] ?? "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month}, ${hours}:${minutes}`;
}

export function dateTimeLocalToIsoUtc(dateTimeLocalValue: string): string {
  return new Date(dateTimeLocalValue).toISOString();
}

export function isoUtcToDateTimeLocal(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${String(year)}-${month}-${day}T${hours}:${minutes}`;
}
