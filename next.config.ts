import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "img.clerk.com" },
      { hostname: "placehold.co" },
      // 스마트스토어 이미지 도메인
      { hostname: "shop1.phinf.naver.net" },
      { hostname: "shop-phinf.pstatic.net" },
      // Supabase Storage 도메인 (환경변수에서 가져오기)
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? (() => {
            try {
              return [
                {
                  hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
                    .hostname,
                },
              ];
            } catch {
              return [];
            }
          })()
        : []),
    ],
    // 이미지 최적화 설정
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  // Server Actions body 크기 제한 증가 (이미지 일괄 업로드용)
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb", // 기본 1MB에서 50MB로 증가
    },
  },
  // 성능 최적화: 컴파일러 옵션
  compiler: {
    // 프로덕션에서 console.log 제거 (성능 최적화)
    // 빌드 문제 해결을 위해 임시로 비활성화
    removeConsole: false,
  },
};

// Sentry 설정 (빌드 문제 해결을 위해 임시로 비활성화)
// 빌드가 정상적으로 완료되면 아래 주석을 해제하여 Sentry를 다시 활성화할 수 있습니다.
// export default withSentryConfig(nextConfig, {
//   org: "ttottoangseu",
//   project: "javascript-nextjs",
//   silent: !process.env.CI,
//   widenClientFileUpload: false,
//   tunnelRoute: "/monitoring",
//   webpack: {
//     automaticVercelMonitors: true,
//     treeshake: {
//       removeDebugLogging: true,
//     },
//   },
// });

export default nextConfig;
