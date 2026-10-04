import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth";
import { LiteModeProvider } from "@/components/lite-mode";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth-server";
import { isLiteMode } from "@/lib/lite-mode-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// The code font is used on few pages, so it is fetched only where it appears.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "DhruvSetu",
  description:
    "India's Polar Science Knowledge, Analysis and Outreach Platform",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lite = await isLiteMode();
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      // In Lite Mode code is shown in the device's own monospace font.
      className={`${geistSans.variable} ${lite ? "" : geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider user={user}>
          <LiteModeProvider initialLite={lite}>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </LiteModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
