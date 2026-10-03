export function formatDate(value: string | null): string {
  if (value === null) {
    return "Not listed";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (start === null && end === null) {
    return "Dates not listed";
  }

  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}
