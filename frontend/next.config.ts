import type { NextConfig } from "next";

const apiUrl =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // The browser reaches the API through this site. The login cookie then
  // belongs to this site, and no request has to cross to another site.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
  experimental: {
    // Data Lab cells and assistant answers can take longer than the default.
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
