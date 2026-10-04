import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard, AuthForm } from "@/components/auth-form";
import { safeNextPath } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Create an account",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const value = (await searchParams).next;
  const next = safeNextPath(Array.isArray(value) ? value[0] : value);
  if ((await getCurrentUser()) !== null) {
    redirect(next);
  }

  return (
    <AuthCard
      description="New accounts are standard user accounts. Research access is given by a DhruvSetu admin."
      title="Create an account"
    >
      <AuthForm mode="register" next={next} />
    </AuthCard>
  );
}
