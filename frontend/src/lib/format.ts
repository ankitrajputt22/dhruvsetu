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
  // Some sources give only the day an expedition began.
  if (end === null) {
    return `From ${formatDate(start)}`;
  }
  if (start === null) {
    return `Until ${formatDate(end)}`;
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

// The address of a DOI at doi.org. A value that is not a DOI gives no link.
export function doiUrl(doi: string | null): string | null {
  const value = doi?.trim() ?? "";
  // A DOI is "10.", a registrant number, a slash and a name without spaces.
  return /^10\.\d{4,9}\/\S+$/.test(value) ? safeExternalUrl(`https://doi.org/${value}`) : null;
}

// Where a publication can be read: its stored source link, or else its DOI.
// A publication with neither has no link. None is ever made up.
export function publicationUrl(publication: {
  source_url: string | null;
  doi: string | null;
}): string | null {
  return safeExternalUrl(publication.source_url) ?? doiUrl(publication.doi);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 4 });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

// A value from a data file, written the way the file has it: no rounding and
// no thousands separator, so a year stays 2016 and 0.14452 keeps every digit.
export function formatDataValue(value: number): string {
  return String(value);
}

const plainNumberFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 4,
  useGrouping: false,
});

// A rounded value that sits beside file values, such as a mean or an axis
// tick. It has no thousands separator, so it reads like the values around it.
export function formatPlainNumber(value: number): string {
  return plainNumberFormat.format(value);
}

export function formatCoordinates(
  latitude: number | null,
  longitude: number | null,
): string | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  const northSouth = latitude >= 0 ? "N" : "S";
  const eastWest = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(4)}° ${northSouth}, ${Math.abs(longitude).toFixed(4)}° ${eastWest}`;
}
