import { cookies } from "next/headers";

import { LITE_COOKIE } from "@/lib/lite-mode";

// Lets server-rendered pages leave out images in Lite Mode, so the browser
// never requests them.
export async function isLiteMode(): Promise<boolean> {
  return (await cookies()).get(LITE_COOKIE)?.value === "1";
}
