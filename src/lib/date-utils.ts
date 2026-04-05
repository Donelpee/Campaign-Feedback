export function parseDateOnlyStart(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
}

export function parseDateOnlyEnd(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);
}

export function formatDateOnly(value: string, locale?: string): string {
  const date = parseDateOnlyStart(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale);
}
