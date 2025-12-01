import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 환경 변수 체크 (빌드 타임에 확인)
const hasClerkKeys =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// Clerk 미들웨어 생성 (환경 변수가 있을 때만)
const clerkMiddlewareHandler = hasClerkKeys
  ? clerkMiddleware()
  : undefined;

// 에러 핸들링이 포함된 미들웨어
export default async function middleware(req: NextRequest) {
  try {
    // 환경 변수가 없으면 경고만 출력하고 계속 진행
    if (!hasClerkKeys) {
      console.warn(
        "⚠️ Clerk 환경 변수가 설정되지 않았습니다. 미들웨어가 비활성화됩니다."
      );
      return NextResponse.next();
    }

    // Clerk 미들웨어 실행
    if (clerkMiddlewareHandler) {
      return await clerkMiddlewareHandler(req);
    }

    return NextResponse.next();
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
