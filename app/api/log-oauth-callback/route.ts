import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * OAuth 콜백 결과를 서버에 로깅하는 API
 * 
 * 클라이언트에서 OAuth 콜백 후 세션 상태를 서버에 전송하여 로그로 남깁니다.
 * 이 로그는 서버 터미널에서 확인할 수 있습니다.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      isSignedIn,
      userId,
      sessionId,
      hasUser,
      externalAccounts,
    } = body;

    // 검증 판정
    if (!isSignedIn || !userId || !sessionId) {
      logger.error("[POST /api/log-oauth-callback] 검증 실패: 세션 미생성", {
        isSignedIn,
        hasUserId: !!userId,
        hasSessionId: !!sessionId,
      });
    } else if (hasUser && (!externalAccounts || externalAccounts.length === 0)) {
      logger.warn("[POST /api/log-oauth-callback] External Account 미연결", {
        userId,
        hasUser,
        externalAccountsCount: externalAccounts?.length || 0,
      });
    } else {
      logger.debug("[POST /api/log-oauth-callback] 검증 성공", {
        userId,
        sessionId,
        hasExternalAccounts: (externalAccounts?.length || 0) > 0,
      });
    }

    return NextResponse.json({ 
      success: true,
      message: "로그가 서버에 저장되었습니다. 터미널을 확인하세요." 
    });
  } catch (error) {
    logger.error("[POST /api/log-oauth-callback] 로그 저장 실패", error);
    return NextResponse.json(
      { error: "로그 저장 실패", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

