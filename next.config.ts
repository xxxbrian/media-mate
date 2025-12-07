import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // allow optimization; limit to known poster/CDN domains and our proxy
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
