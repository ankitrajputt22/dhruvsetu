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


export function formatPages(first: number | null, last: number | null): string | null {
  if (first === null || last === null) {
    return null;
  }

  return first === last ? `Page ${first}` : `Pages ${first}–${last}`;
}

// Only normal web links are ever rendered as an original source link.
export function safeExternalUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
