"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState } from "react";

import { postApi } from "@/lib/api";
import {
  type AuthUser,
  canUseDataLab,
  canUseWorkspace,
  isAdmin,
  roleLabels,
  userName,
} from "@/lib/auth";

const AuthContext = createContext<AuthUser | null>(null);

// The signed-in user comes from the server with each page. Signing in or out
// asks the server for the page again, which brings the new value.
export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthUser | null {
  return useContext(AuthContext);
}

function useLogout(): { logout: () => void; busy: boolean } {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    await postApi("/api/auth/logout", {});
    setBusy(false);
    router.push("/");
    router.refresh();
  }

  return { logout: () => void logout(), busy };
}

// Links a signed-in person gets because of their role.
function roleLinks(user: AuthUser): { href: string; label: string }[] {
  return [
    ...(isAdmin(user) ? [{ href: "/admin", label: "Admin" }] : []),
    ...(canUseWorkspace(user)
      ? [{ href: "/researcher", label: "Research Workspace" }]
      : [{ href: "/account/researcher-access", label: "Researcher Access" }]),
    ...(canUseDataLab(user) ? [{ href: "/data-lab", label: "Polar Data Lab" }] : []),
  ];
}

// Account control in the wide header.
export function AccountMenu() {
  const user = useAuth();
  const { logout, busy } = useLogout();
  const menu = useRef<HTMLDetailsElement>(null);

  if (user === null) {
    return (
      <Link
        className="whitespace-nowrap rounded-full border border-white/35 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
        href="/login"
      >
        Login
      </Link>
    );
  }

  return (
    <details className="relative" ref={menu}>
      <summary className="flex max-w-44 cursor-pointer list-none items-center gap-1.5 rounded-full border border-white/35 px-3 py-1.5 text-xs font-semibold text-white marker:content-none hover:bg-white/10">
        <span className="truncate">{userName(user)}</span>
        <span aria-hidden="true">▾</span>
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-xl">
        <p className="break-words font-semibold text-slate-950">{userName(user)}</p>
        <p className="break-all text-xs text-slate-500">{user.email}</p>
        <p className="mt-1 text-xs text-slate-600">Role: {roleLabels[user.role]}</p>
        <ul className="mt-2 border-t border-slate-200 pt-2">
          {roleLinks(user).map((link) => (
            <li key={link.href}>
              <Link
                className="block rounded-md px-2 py-1.5 hover:bg-sky-50 hover:text-sky-900"
                href={link.href}
                onClick={() => menu.current?.removeAttribute("open")}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-sky-50 hover:text-sky-900 disabled:opacity-50"
              disabled={busy}
              onClick={logout}
              type="button"
            >
              Logout
            </button>
          </li>
        </ul>
      </div>
    </details>
  );
}

// Account entries inside the small-screen menu.
export function AccountMenuItems() {
  const user = useAuth();
  const { logout, busy } = useLogout();
  const itemClass = "block w-full rounded-md px-3 py-2.5 text-left hover:bg-sky-50 hover:text-sky-900";

  if (user === null) {
    return (
      <li className="border-t border-slate-200 pt-1">
        <Link className={itemClass} href="/login">
          Login
        </Link>
      </li>
    );
  }

  return (
    <>
      <li className="border-t border-slate-200 px-3 pb-1 pt-3">
        <p className="break-words font-semibold text-slate-950">{userName(user)}</p>
        <p className="text-xs text-slate-600">Role: {roleLabels[user.role]}</p>
      </li>
      {roleLinks(user).map((link) => (
        <li key={link.href}>
          <Link className={itemClass} href={link.href}>
            {link.label}
          </Link>
        </li>
      ))}
      <li>
        <button className={`${itemClass} disabled:opacity-50`} disabled={busy} onClick={logout} type="button">
          Logout
        </button>
      </li>
    </>
  );
}
