import type { ResearcherAccessStatus } from "@/lib/types";

// The words shown for each state. A waiting request is never called access.
export const accessStatusLabels: Record<ResearcherAccessStatus, string> = {
  none: "No researcher access request",
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  removed: "Removed",
};

export const accessStatusMeanings: Record<ResearcherAccessStatus, string> = {
  none: "You have not asked for researcher access.",
  pending:
    "An administrator will review your request. Until it is approved, your account has normal user access.",
  approved: "Your account has researcher access.",
  rejected: "Your request was not approved. Your account has normal user access.",
  removed:
    "Researcher access was removed from this account by an administrator. Your account has normal user access.",
};

// The same limits and file types the API applies.
export const DOCUMENT_FILE_TYPES = ["pdf", "txt"] as const;
export const DATASET_FILE_TYPES = ["csv", "json"] as const;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_DATASET_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_TYPES = [
  { value: "research_paper", label: "Research paper" },
  { value: "report", label: "Report" },
  { value: "field_notes", label: "Field notes" },
  { value: "technical_note", label: "Technical note" },
  { value: "data_description", label: "Data description" },
  { value: "other", label: "Other" },
] as const;

export function fileTypeOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

// Why a chosen file cannot be sent, or null when it can.
export function fileProblem(
  file: File | null,
  allowed: readonly string[],
  maxBytes: number,
): string | null {
  const types = allowed.map((type) => type.toUpperCase()).join(" or ");
  if (file === null) {
    return `Choose a ${types} file.`;
  }
  if (!allowed.includes(fileTypeOf(file.name))) {
    return `Only ${types} files can be submitted.`;
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  return file.size > maxBytes
    ? `The file is larger than ${maxBytes / (1024 * 1024)} MB.`
    : null;
}
