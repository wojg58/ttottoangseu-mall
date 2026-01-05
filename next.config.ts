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
                  hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
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
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"], // error와 warn은 유지
    } : false,
  },
};

// Sentry 설정 (빌드 속도 개선을 위해 일부 옵션 비활성화)
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "ttottoangseu",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  // 빌드 속도 개선을 위해 비활성화 (필요시 활성화)
  widenClientFileUpload: false,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
