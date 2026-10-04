import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard, AuthForm } from "@/components/auth-form";
import { safeNextPath } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Login",
};

export default async function LoginPage({
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
      description="The repository is open to everyone. Login is only needed for Polar Data Lab and the admin area."
      title="Login"
    >
      <AuthForm mode="login" next={next} />
    </AuthCard>
  );
}
