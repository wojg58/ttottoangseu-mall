import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "img.clerk.com" },
      { hostname: "placehold.co" },
      // Supabase Storage 도메인 (환경변수에서 가져오기)
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? [
            {
              hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
