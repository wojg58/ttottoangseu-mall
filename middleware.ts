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
  "/api/test(.*)", // 테스트 엔드포인트는 인증 없이 접근 가능
  "/products(.*)",
  "/company",
  "/terms",
  "/privacy",
  "/guide",
]);

// 관리자 전용 경로 정의
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// 관리자 이메일 목록 (하위 호환성)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS?.split(",") || [
  "admin@ttottoangs.com",
]).map((email) => email.trim().toLowerCase());

/**
 * 관리자 권한 확인 (middleware용)
 * 
 * 우선순위:
 * 1. sessionClaims.metadata.role === 'admin'
 * 2. sessionClaims.metadata.isAdmin === true
 * 3. 이메일 기반 체크 (하위 호환성)
 * 
 * @param sessionClaims Clerk session claims
 * @returns 관리자 여부
 */
function isAdminFromClaims(sessionClaims: any): boolean {
  // 1. role 체크
  if (sessionClaims?.metadata?.role === "admin") {
    return true;
  }

  // 2. isAdmin 체크
  if (sessionClaims?.metadata?.isAdmin === true) {
    return true;
  }

  // 3. 이메일 기반 체크 (하위 호환성)
  const email = sessionClaims?.email as string | undefined;
  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    return ADMIN_EMAILS.includes(normalizedEmail);
  }

  return false;
}

// Clerk 미들웨어 생성 (환경 변수가 있을 때만)
const clerkMiddlewareHandler = hasClerkKeys
  ? clerkMiddleware(async (auth, request) => {
      // 관리자 경로 체크
      if (isAdminRoute(request)) {
        const { sessionClaims, userId, redirectToSignIn } = await auth();

        // 인증되지 않은 사용자는 로그인 페이지로 리다이렉트
        if (!userId) {
          console.log("[middleware] ❌ 관리자 경로 접근 시도 - 미인증 사용자");
          return redirectToSignIn({ returnBackUrl: request.url });
        }

        // 관리자 권한 확인
        const isAdmin = isAdminFromClaims(sessionClaims);
        if (!isAdmin) {
          console.log("[middleware] ❌ 관리자 경로 접근 시도 - 권한 없음", {
            userId,
            role: sessionClaims?.metadata?.role,
            isAdmin: sessionClaims?.metadata?.isAdmin,
            email: sessionClaims?.email,
          });
          // 비관리자는 홈으로 리다이렉트
          return NextResponse.redirect(new URL("/", request.url));
        }

        console.log("[middleware] ✅ 관리자 경로 접근 허용", {
          userId,
          role: sessionClaims?.metadata?.role,
          isAdmin: sessionClaims?.metadata?.isAdmin,
        });
      }

      // 공개 경로가 아니면 인증 요구
      if (!isPublicRoute(request) && !isAdminRoute(request)) {
        await auth.protect();
      }
    })
  : undefined;

// CORS 허용 도메인 설정
const getAllowedOrigins = (): string[] => {
  const origins = process.env.ALLOWED_ORIGINS;
  if (!origins) {
    // 기본값: 프로덕션 도메인
    return ["https://ttottoangseu.co.kr"];
  }
  // 쉼표로 구분된 도메인 목록 파싱
  return origins.split(",").map((origin) => origin.trim());
};

// Origin 검증 함수
const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.some((allowed) => {
    // 정확한 매칭 또는 와일드카드 서브도메인 매칭
    if (allowed === origin) return true;
    if (allowed.startsWith("*.")) {
      const domain = allowed.substring(2);
      return origin.endsWith(`.${domain}`);
    }
    return false;
  });
};

// CORS 헤더 생성
const getCorsHeaders = (origin: string | null): HeadersInit => {
  const headers: HeadersInit = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Max-Age": "86400", // 24시간
    "Access-Control-Allow-Credentials": "true",
  };

  // 허용된 Origin인 경우에만 CORS 헤더 추가
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

// 에러 핸들링이 포함된 미들웨어
export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent
) {
  try {
    // OPTIONS 요청 처리 (CORS preflight)
    if (req.method === "OPTIONS") {
      const origin = req.headers.get("origin");
      return new NextResponse(null, {
        status: 200,
        headers: getCorsHeaders(origin),
      });
    }

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
    // Clerk Production 도메인 추가: https://clerk.ttottoangseu.co.kr, https://*.clerk.services
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.ttottoangseu.co.kr https://*.clerk.services https://www.googletagmanager.com https://www.google-analytics.com https://cdn.channel.io https://channels.angel.co https://t1.daumcdn.net https://js.tosspayments.com",
      "worker-src 'self' blob: https://*.clerk.accounts.dev https://clerk.ttottoangseu.co.kr https://*.clerk.services",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
      "img-src 'self' data: https: blob:",
      "media-src 'self' data: blob:",
      "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.clerk.accounts.dev https://clerk.ttottoangseu.co.kr https://*.clerk.services https://*.clerk-telemetry.com https://*.supabase.co https://api.channel.io https://*.ingest.sentry.io https://*.sentry.io https://t1.daumcdn.net https://api.tosspayments.com https://log.tosspayments.com https://*.tosspayments.com",
      "frame-src 'self' https://*.clerk.accounts.dev https://clerk.ttottoangseu.co.kr https://*.clerk.services https://channels.angel.co https://t1.daumcdn.net https://postcode.map.daum.net https://pay.tosspayments.com https://*.tosspayments.com https://pay.toss.im https://toss.im https://*.toss.im",
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

    // CORS 헤더 추가 (API 라우트에만)
    const origin = req.headers.get("origin");
    if (req.nextUrl.pathname.startsWith("/api")) {
      const corsHeaders = getCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

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
