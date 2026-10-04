"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { postApi } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 10;

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("display_name") ?? "").trim();

    setBusy(true);
    setError(null);
    const result = registering
      ? await postApi<AuthUser>("/api/auth/register", {
          email,
          password,
          ...(displayName ? { display_name: displayName } : {}),
        })
      : await postApi<AuthUser>("/api/auth/login", { email, password });

    if (result.data === null) {
      setBusy(false);
      setError(
        result.detail ??
          (result.status === 422
            ? `Please enter a valid email address and a password of at least ${MIN_PASSWORD_LENGTH} characters.`
            : "We could not reach DhruvSetu right now. Please try again."),
      );
      return;
    }
    // The page is asked for again, so the header and the page see the new login.
    router.push(next);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      {registering && (
        <label className="block text-sm font-medium text-slate-800">
          Name <span className="font-normal text-slate-500">(optional)</span>
          <input autoComplete="name" className={inputClass} maxLength={120} name="display_name" type="text" />
        </label>
      )}
      <label className="block text-sm font-medium text-slate-800">
        Email
        <input autoComplete="email" className={inputClass} maxLength={255} name="email" required type="email" />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Password
        <input
          autoComplete={registering ? "new-password" : "current-password"}
          className={inputClass}
          maxLength={128}
          minLength={registering ? MIN_PASSWORD_LENGTH : undefined}
          name="password"
          required
          type="password"
        />
        {registering && (
          <span className="mt-1 block text-xs font-normal text-slate-500">
            At least {MIN_PASSWORD_LENGTH} characters.
          </span>
        )}
      </label>

      {error !== null && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}

      <button
        className="w-full rounded-lg bg-sky-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {busy ? "Please wait…" : registering ? "Create account" : "Login"}
      </button>

      <p className="text-sm text-slate-600">
        {registering ? "Already have an account? " : "New to DhruvSetu? "}
        <Link
          className="font-semibold text-sky-800 hover:underline"
          href={`${registering ? "/login" : "/register"}${nextQuery}`}
        >
          {registering ? "Login" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-12 lg:py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
