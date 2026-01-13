import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  sanitizeDatabaseError,
  logError,
} from "@/lib/error-handler";
import {
  rateLimitMiddleware,
  rateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * @file app/api/chat/session/route.ts
 * @description 챗봇 세션 생성 API (로그인 필수)
 *
 * 흐름:
 * - Clerk auth()로 로그인 확인
 * - Supabase users에서 clerk_user_id로 user row 조회 (없으면 Clerk에서 가져와 생성)
 * - chat_sessions 생성 후 sessionId 반환
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Rate Limiting 체크
  const rateLimitResult = await rateLimitMiddleware(
    request,
    RATE_LIMITS.SYNC_USER.limit, // 세션 생성도 사용자 동기화와 동일한 제한
    RATE_LIMITS.SYNC_USER.window,
  );

  if (!rateLimitResult?.success) {
    logger.warn("[POST /api/chat/session] RateLimit 초과");
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimitResult),
      },
    );
  }

  try {
    const { userId } = await auth();

    if (!userId) {
      logger.warn("[POST /api/chat/session] 인증 실패: userId 없음");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();

    // 1) users row 조회
    const { data: existingUser, error: userFetchError } = await supabase
      .from("users")
      .select("*")
      .eq("clerk_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (userFetchError) {
      logError(userFetchError, { api: "/api/chat/session", step: "fetch_user" });
      return NextResponse.json(
        { error: sanitizeDatabaseError(userFetchError) },
        { status: 500 },
      );
    }

    let userRow = existingUser as { id: string } | null;

    // 2) 없으면 Clerk에서 가져와 생성
    if (!userRow) {
      logger.debug("[POST /api/chat/session] Supabase 사용자 없음, Clerk에서 생성");
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);

      const insertData = {
        clerk_user_id: clerkUser.id,
        name:
          clerkUser.fullName ||
          clerkUser.username ||
          clerkUser.emailAddresses[0]?.emailAddress ||
          "Unknown",
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        role: "customer",
      };

      const { data: insertedUser, error: insertError } = await supabase
        .from("users")
        .insert(insertData)
        .select("id")
        .single();

      if (insertError) {
        logError(insertError, { api: "/api/chat/session", step: "create_user" });
        return NextResponse.json(
          { error: sanitizeDatabaseError(insertError) },
          { status: 500 },
        );
      }

      userRow = insertedUser as { id: string };
    }

    // 3) 최근 활성 세션 확인 (중복 생성 방지)
    // 최근 1분 이내에 생성된 세션이 있으면 재사용
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentSession } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", userRow.id)
      .is("deleted_at", null)
      .gte("created_at", oneMinuteAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentSession) {
      logger.debug("[POST /api/chat/session] 최근 세션 재사용", { sessionId: recentSession.id });
      return NextResponse.json({ sessionId: recentSession.id });
    }

    // 4) 새 chat session 생성
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .insert({ user_id: userRow.id })
      .select("id")
      .single();

    if (sessionError) {
      logError(sessionError, { api: "/api/chat/session", step: "create_session" });
      return NextResponse.json(
        { error: sanitizeDatabaseError(sessionError) },
        { status: 500 },
      );
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (e) {
    logError(e, { api: "/api/chat/session", step: "unexpected_error" });
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}


