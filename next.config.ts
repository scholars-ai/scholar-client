import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const coreOrigin = process.env.CORE_API_ORIGIN ?? "http://127.0.0.1:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${coreOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
