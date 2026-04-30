import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Entry artifact file uploads can be up to 100MB (Cloudflare free tier
  // request body cap). Server actions default to 1MB; raise it.
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/projects/:slug/data',
        destination: '/projects/:slug/results',
        permanent: true,
      },
      {
        source: '/projects/:slug/data/:path*',
        destination: '/projects/:slug/results/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
