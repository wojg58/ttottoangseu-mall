import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import * as Sentry from "@sentry/nextjs";
import {
  sanitizeDatabaseError,
  sanitizeAuthError,
  logError,
} from "@/lib/error-handler";
import {
  rateLimitMiddleware,
  rateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Clerk 사용자를 Supabase users 테이블에 동기화하는 API
 *
 * 클라이언트에서 로그인 후 이 API를 호출하여 사용자 정보를 Supabase에 저장합니다.
 * 이미 존재하는 경우 업데이트하고, 없으면 새로 생성합니다.
 */
export async function POST(request: Request) {
  try {
    // Rate Limiting 체크
    const rateLimitResult = await rateLimitMiddleware(
      request,
      RATE_LIMITS.SYNC_USER.limit,
      RATE_LIMITS.SYNC_USER.window,
    );

    if (!rateLimitResult?.success) {
      logger.warn("[POST /api/sync-user] RateLimit 초과");
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimitResult),
        },
      );
    }

    // Clerk 인증 확인
    const authResult = await auth();
    let userId = authResult?.userId;

    // auth()로 userId를 못 가져온 경우, Authorization 헤더에서 토큰 확인
    if (!userId) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        // 토큰이 있으면 auth()를 다시 시도 (미들웨어가 처리했을 수 있음)
        const retryAuth = await auth();
        userId = retryAuth?.userId;
      }
    }

    if (!userId) {
      logger.error("[POST /api/sync-user] 인증 실패: userId 없음");
      
      // Sentry에 인증 실패 이벤트 전송
      Sentry.captureMessage("사용자 동기화 API 인증 실패", {
        level: "error",
        tags: {
          api: "sync-user",
          auth_status: "failed",
        },
        contexts: {
          request: {
            headers: Object.fromEntries(request.headers.entries()),
            method: request.method,
            url: request.url,
          },
        },
      });
      
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clerk에서 사용자 정보 가져오기
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    if (!clerkUser) {
      logger.error("[POST /api/sync-user] Clerk 사용자 없음", { userId });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // External Accounts 상세 로그 (핵심: 네이버 로그인 연결 여부 확인)
    if (!clerkUser.externalAccounts || clerkUser.externalAccounts.length === 0) {
      logger.warn("[POST /api/sync-user] External Accounts 없음", {
        userId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress,
      });
      
      // Sentry에 External Account 누락 이벤트 전송
      Sentry.captureMessage("OAuth External Account 누락 - 사용자 동기화 API", {
        level: "warning",
        tags: {
          api: "sync-user",
          oauth_provider: "naver",
          external_account: "missing",
        },
        contexts: {
          clerk_user: {
            id: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            createdAt: clerkUser.createdAt
              ? new Date(clerkUser.createdAt).toISOString()
              : undefined,
          },
        },
        extra: {
          possibleCauses: [
            "Proxy 서버 응답의 'sub' 값이 Clerk가 기대하는 형식과 다름",
            "Clerk Dashboard의 Attribute Mapping 설정 문제",
            "Proxy 서버가 Clerk에 응답을 제대로 반환하지 못함",
          ],
        },
      });
    }
    
    // 이메일 주소 상세 확인
    if (!clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
      logger.warn("[POST /api/sync-user] 이메일 주소 없음", { userId: clerkUser.id });
    }

    // Supabase에 사용자 정보 동기화
    const supabase = getServiceRoleClient();

    const userData = {
      clerk_user_id: clerkUser.id,
      name:
        clerkUser.fullName ||
        clerkUser.username ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        "Unknown",
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      role: "customer",
    };

    // 먼저 clerk_user_id로 기존 사용자 조회 (삭제되지 않은 사용자만)
    const { data: existingUserByClerkId, error: fetchErrorByClerkId } =
      await supabase
        .from("users")
        .select("*")
        .eq("clerk_user_id", clerkUser.id)
        .is("deleted_at", null)
        .maybeSingle();

    if (fetchErrorByClerkId) {
      logError(fetchErrorByClerkId, { api: "/api/sync-user", step: "fetch_user_by_clerk_id" });
      return NextResponse.json(
        { error: sanitizeDatabaseError(fetchErrorByClerkId) },
        { status: 500 },
      );
    }

    let existingUser = existingUserByClerkId;

    // clerk_user_id로 찾지 못했고, 이메일이 있는 경우 이메일로도 조회
    if (!existingUser && userData.email) {
      const { data: existingUserByEmail, error: fetchErrorByEmail } =
        await supabase
          .from("users")
          .select("*")
          .eq("email", userData.email)
          .is("deleted_at", null)
          .maybeSingle();

      if (fetchErrorByEmail) {
        logger.warn("[POST /api/sync-user] 이메일로 사용자 조회 실패", fetchErrorByEmail);
        // 이메일 조회 실패는 치명적이지 않으므로 계속 진행
      } else if (existingUserByEmail) {
        logger.debug("[POST /api/sync-user] 같은 이메일 사용자 발견, clerk_user_id 연결");
        existingUser = existingUserByEmail;
      }
    }

    let result;
    if (existingUser) {
      // 기존 사용자 업데이트
      const updateData: {
        name: string;
        email: string;
        role: string;
        clerk_user_id?: string;
      } = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
      };

      // clerk_user_id가 없거나 다른 경우 업데이트
      if (existingUser.clerk_user_id !== clerkUser.id) {
        logger.debug(`[POST /api/sync-user] clerk_user_id 업데이트: ${existingUser.clerk_user_id} → ${clerkUser.id}`);
        updateData.clerk_user_id = clerkUser.id;
      }

      const { data, error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateError) {
        logError(updateError, { api: "/api/sync-user", step: "update_user" });
        return NextResponse.json(
          { error: sanitizeDatabaseError(updateError) },
          { status: 500 },
        );
      }
      result = data;
    } else {
      // 새 사용자 생성
      const { data, error: insertError } = await supabase
        .from("users")
        .insert(userData)
        .select()
        .single();

      if (insertError) {
        logError(insertError, { api: "/api/sync-user", step: "create_user" });
        return NextResponse.json(
          { error: sanitizeDatabaseError(insertError) },
          { status: 500 },
        );
      }
      result = data;

      // 신규 가입 시 1,000원 쿠폰 발급
      const couponCode = `WELCOME-${result.id.toString().substring(0, 8).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후 만료

      const { error: couponError } = await supabase.from("coupons").insert({
        user_id: result.id,
        code: couponCode,
        name: "신규가입 환영 쿠폰",
        discount_type: "fixed",
        discount_amount: 1000,
        min_order_amount: 0,
        status: "active",
        expires_at: expiresAt.toISOString(),
      });

      if (couponError) {
        logger.warn("[POST /api/sync-user] 쿠폰 발급 실패 (사용자 생성은 성공)", couponError);
      }
    }

    return NextResponse.json({
      success: true,
      user: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    
    logger.error("[POST /api/sync-user] 예외 발생", {
      name: errorName,
      message: errorMessage,
      type: error instanceof Error ? "Error" : typeof error,
    });
    
    // Sentry에 에러 전송
    Sentry.captureException(error, {
      tags: {
        api: "sync-user",
        error_type: errorName,
      },
    });
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 },
    );
  }
}
