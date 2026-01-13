/**
 * @file app/api/auth/check-session/route.ts
 * @description 클라이언트에서 서버 세션 상태 확인 API
 * 
 * 배포 환경에서 클라이언트와 서버의 세션 동기화 문제를 해결하기 위해
 * 서버 사이드에서 실제 세션 상태를 확인하고 반환합니다.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId, sessionId } = await auth();
    
    // 세션 상태 로깅 (배포 환경 디버깅용)
    const isAuthenticated = !!userId;
    
    logger.debug("[GET /api/auth/check-session] 세션 확인", {
      userId: userId || null,
      sessionId: sessionId || null,
      isAuthenticated,
    });

    return NextResponse.json({
      success: true,
      isAuthenticated,
      userId: userId || null,
      sessionId: sessionId || null,
    });
  } catch (error) {
    logger.error("[GET /api/auth/check-session] 세션 확인 실패", error);
    return NextResponse.json(
      {
        success: false,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

