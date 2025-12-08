import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "img.clerk.com" },
      { hostname: "placehold.co" },
      // 스마트스토어 이미지 도메인
      { hostname: "shop1.phinf.naver.net" },
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
  // Server Actions body 크기 제한 증가 (이미지 일괄 업로드용)
  // Next.js 15에서는 serverActions 설정 사용
  serverActions: {
    bodySizeLimit: "50mb", // 기본 1MB에서 50MB로 증가
  },
  // Next.js 15 이전 버전 호환성을 위한 experimental 설정도 추가
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
