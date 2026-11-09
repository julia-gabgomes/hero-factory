const UTC_PLUS_14_OFFSET_MS = 14 * 60 * 60 * 1000;

export function isFutureUtcPlus14(dateOfBirth: string, now: Date): boolean {
  const [year, month, day] = dateOfBirth.split("-").map(Number) as [number, number, number];

  const shifted = new Date(now.getTime() + UTC_PLUS_14_OFFSET_MS);
  const todayYear = shifted.getUTCFullYear();
  const todayMonth = shifted.getUTCMonth() + 1;
  const todayDay = shifted.getUTCDate();

  if (year !== todayYear) return year > todayYear;
  if (month !== todayMonth) return month > todayMonth;
  return day > todayDay;
}
