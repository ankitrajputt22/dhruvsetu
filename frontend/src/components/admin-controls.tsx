"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { patchApi } from "@/lib/api";
import { roleLabels } from "@/lib/auth";
import type { AdminRecordDetail, AdminUser } from "@/lib/types";
import { allowedStatusChanges } from "@/lib/verification";

const FAILED = "The change could not be saved. Please try again.";

// The buttons an admin uses to change a record's verification status. Nothing
// changes until a button is pressed.
export function VerificationControls({
  recordType,
  recordId,
  status,
}: {
  recordType: string;
  recordId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  async function change(newStatus: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await patchApi<AdminRecordDetail>(
      `/api/admin/records/${recordType}/${encodeURIComponent(recordId)}/verification`,
      { status: newStatus },
    );
    setBusy(false);
    if (result.data === null) {
      setMessage({ text: result.detail ?? FAILED, failed: true });
      return;
    }
    setMessage({ text: "The status was changed.", failed: false });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {allowedStatusChanges(status).map((option, index) => (
          <button
            className={
              index === 0
                ? "rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:opacity-60"
                : "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
            }
            disabled={busy}
            key={option.status}
            onClick={() => void change(option.status)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {message !== null && (
        <p
          className={`mt-3 text-sm ${message.failed ? "text-red-800" : "text-emerald-800"}`}
          role={message.failed ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

// Lets an admin move an account between User and Researcher.
export function UserRoleControl({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user.role === "admin") {
    return <span className="text-sm text-slate-600">{roleLabels.admin}</span>;
  }

  async function change(role: string) {
    setBusy(true);
    setError(null);
    const result = await patchApi<AdminUser>(
      `/api/admin/users/${encodeURIComponent(user.id)}/role`,
      { role },
    );
    setBusy(false);
    if (result.data === null) {
      setError(result.detail ?? FAILED);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        aria-label={`Role for ${user.email}`}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60"
        disabled={busy}
        onChange={(event) => void change(event.target.value)}
        value={user.role}
      >
        <option value="user">{roleLabels.user}</option>
        <option value="researcher">{roleLabels.researcher}</option>
      </select>
      {error !== null && (
        <p className="mt-1 text-xs text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
