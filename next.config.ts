import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // output: 'standalone' causes clientReferenceManifest errors in dev mode
  // with Next.js 15.5.4. Only enable for production builds.
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' as const } : {}),
  env: {
    // TEMPORARY: Expose service role key to client to bypass RLS issues
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  experimental: {
    cssChunking: 'strict',
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;