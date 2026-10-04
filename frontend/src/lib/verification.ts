export type StatusChange = { status: string; label: string };

// The status changes an admin may make from each status. A record moves one
// step forward at a time, and can be moved back if it was changed by mistake.
// The API applies the same rule.
export function allowedStatusChanges(status: string): StatusChange[] {
  if (status === "uploaded") {
    return [{ status: "reviewed", label: "Mark as Reviewed" }];
  }
  if (status === "reviewed") {
    return [
      { status: "verified", label: "Mark as Verified" },
      { status: "uploaded", label: "Move back to Uploaded" },
    ];
  }
  if (status === "verified") {
    return [
      { status: "reviewed", label: "Move back to Reviewed" },
      { status: "uploaded", label: "Move back to Uploaded" },
    ];
  }
  return [];
}
