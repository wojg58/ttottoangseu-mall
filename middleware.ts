import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

// 환경 변수 체크 (빌드 타임에 확인)
const hasClerkKeys =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// 인증 없이 접근 가능한 공개 경로 정의
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/products(.*)",
  "/company",
  "/terms",
  "/privacy",
  "/guide",
]);

// Clerk 미들웨어 생성 (환경 변수가 있을 때만)
const clerkMiddlewareHandler = hasClerkKeys
  ? clerkMiddleware(async (auth, request) => {
      // 공개 경로가 아니면 인증 요구
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    })
  : undefined;

// 에러 핸들링이 포함된 미들웨어
export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent
) {
  try {
    let response: NextResponse;

    // 환경 변수가 없으면 경고만 출력하고 계속 진행
    if (!hasClerkKeys) {
      console.warn(
        "⚠️ Clerk 환경 변수가 설정되지 않았습니다. 미들웨어가 비활성화됩니다."
      );
      response = NextResponse.next();
    } else if (clerkMiddlewareHandler) {
      // Clerk 미들웨어 실행
      const clerkResponse = await clerkMiddlewareHandler(req, event);
      // clerkMiddleware는 NextResponse | void | undefined를 반환할 수 있음
      response = clerkResponse instanceof NextResponse 
        ? clerkResponse 
        : NextResponse.next();
    } else {
      response = NextResponse.next();
    }

    // 보안 헤더 추가 (Chrome DevTools Issues 패널 문제 해결)
    const headers = new Headers(response.headers);
    
    // Content Security Policy - 서드 파티 스크립트 허용 (필요한 도메인만)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://www.googletagmanager.com https://www.google-analytics.com https://cdn.channel.io https://channels.angel.co https://t1.daumcdn.net https://js.tosspayments.com",
      "worker-src 'self' blob: https://*.clerk.accounts.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
      "img-src 'self' data: https: blob:",
      "media-src 'self' data: blob:",
      "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.clerk.accounts.dev https://*.clerk-telemetry.com https://*.supabase.co https://api.channel.io https://*.ingest.sentry.io https://*.sentry.io https://t1.daumcdn.net https://api.tosspayments.com https://log.tosspayments.com https://*.tosspayments.com",
      "frame-src 'self' https://*.clerk.accounts.dev https://channels.angel.co https://t1.daumcdn.net https://pay.tosspayments.com https://*.tosspayments.com https://pay.toss.im",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    headers.set("Content-Security-Policy", csp);
    
    // 기타 보안 헤더
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-XSS-Protection", "1; mode=block");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

    // 응답에 헤더 적용
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error("❌ 미들웨어 실행 중 에러 발생:", error);
    
    // 에러 발생 시에도 요청은 계속 진행 (사이트가 완전히 다운되지 않도록)
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
