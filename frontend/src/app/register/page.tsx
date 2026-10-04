import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import { safeNextPath } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-server";
import { isLiteMode } from "@/lib/lite-mode-server";

export const metadata: Metadata = {
  title: "Create Account",
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
    <AuthLayout
      lite={await isLiteMode()}
      subtitle="Join India's polar science knowledge platform."
      title="Create your DhruvSetu account"
    >
      <RegisterForm next={next} />
    </AuthLayout>
  );
}
