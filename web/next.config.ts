import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required Attribution: replace Next's default with ChatHermes brand
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Required by LICENSE.md section 2.2 — DO NOT REMOVE
          { key: "X-Powered-By", value: "ChatHermes/1.0 (https://chathermes.com)" },
        ],
      },
    ];
  },
};

export default nextConfig;
