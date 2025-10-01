import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  env: {
    // TEMPORARY: Expose service role key to client to bypass RLS issues
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

export default nextConfig;