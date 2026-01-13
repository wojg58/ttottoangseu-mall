import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { streamGeminiText, type ChatMessageForModel } from "@/lib/gemini/server";
import { SYSTEM_PROMPT } from "@/lib/gemini/system-prompt";
import {
  rateLimitMiddleware,
  rateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  chatMessageSchema,
  validateSchema,
} from "@/lib/validation";
import {
  sanitizeDatabaseError,
  logError,
} from "@/lib/error-handler";
import { logger } from "@/lib/logger";

/**
 * @file app/api/chat/stream/route.ts
 * @description 챗봇 스트리밍 응답 API (로그인 필수, SSE)
 *
 * 클라이언트는 이 API를 호출하고 response.body 스트림을 읽어 토큰을 실시간으로 렌더링합니다.
 *
 * 서버 처리:
 * 1) Clerk auth()로 로그인 확인
 * 2) 입력 검증 (Zod 스키마)
 * 3) session 소유자 검증
 * 4) user 메시지 저장
 * 5) 최근 메시지 히스토리 로드 후 Gemini 스트리밍 호출
 * 6) 토큰을 SSE로 흘리고, 최종 assistant 메시지 저장
 */

export const runtime = "nodejs";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  // Rate Limiting 체크
  const rateLimitResult = await rateLimitMiddleware(
    req,
    RATE_LIMITS.CHAT.limit,
    RATE_LIMITS.CHAT.window,
  );

  if (!rateLimitResult?.success) {
    logger.warn("[POST /api/chat/stream] RateLimit 초과");
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimitResult),
      },
    );
  }

  const encoder = new TextEncoder();

  try {
    const { userId } = await auth();

    if (!userId) {
      logger.warn("[POST /api/chat/stream] 인증 실패: userId 없음");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 입력 검증
    const body = await req.json();
    const validationResult = validateSchema(chatMessageSchema, body);

    if (validationResult.success === false) {
      logger.warn("[POST /api/chat/stream] 검증 실패", { error: validationResult.error });
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 },
      );
    }

    // 타입 가드: success가 true이면 data가 존재함
    const { sessionId, message } = validationResult.data;

    const supabase = getServiceRoleClient();

    // 1) users.id 조회
    const { data: userRow, error: userFetchError } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (userFetchError) {
      logError(userFetchError, { api: "/api/chat/stream", step: "fetch_user" });
      return NextResponse.json(
        { error: sanitizeDatabaseError(userFetchError) },
        { status: 500 },
      );
    }

    if (!userRow) {
      logger.warn("[POST /api/chat/stream] 사용자 미동기화", { userId });
      return NextResponse.json(
        { error: "User not found. Please sign out/in again." },
        { status: 404 },
      );
    }

    // 2) session 소유자 검증 (created_at 포함하여 만료 확인 가능하도록)
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id,user_id,created_at")
      .eq("id", sessionId)
      .is("deleted_at", null)
      .maybeSingle();

    if (sessionError) {
      logError(sessionError, { api: "/api/chat/stream", step: "fetch_session" });
      return NextResponse.json(
        { error: sanitizeDatabaseError(sessionError) },
        { status: 500 },
      );
    }

    if (!session) {
      logger.warn("[POST /api/chat/stream] 세션 없음", { sessionId });
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 세션 소유자 검증 (보안 강화)
    if (session.user_id !== userRow.id) {
      logError(
        new Error("Session owner mismatch"),
        {
          api: "/api/chat/stream",
          step: "session_owner_verification",
          sessionId,
          sessionUserId: session.user_id,
          requestUserId: userRow.id,
        }
      );
      logger.warn("[POST /api/chat/stream] 세션 소유자 불일치", {
        sessionUserId: session.user_id,
        requestUserId: userRow.id,
      });
      return NextResponse.json(
        { error: "세션에 접근할 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 세션 만료 확인 (선택사항: 24시간 이상 된 세션은 만료 처리)
    const sessionAge = Date.now() - new Date(session.created_at || 0).getTime();
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24시간
    if (sessionAge > maxSessionAge) {
      logger.warn("[POST /api/chat/stream] 세션 만료", { sessionId, age: sessionAge });
      return NextResponse.json(
        { error: "세션이 만료되었습니다. 새 세션을 생성해주세요." },
        { status: 410 } // 410 Gone
      );
    }

    // 3) user 메시지 저장
    const { error: insertUserMsgError } = await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "user", content: message });

    if (insertUserMsgError) {
      logError(insertUserMsgError, { api: "/api/chat/stream", step: "insert_message" });
      return NextResponse.json(
        { error: sanitizeDatabaseError(insertUserMsgError) },
        { status: 500 },
      );
    }

    // 4) 히스토리 로드 (최근 N개)
    const HISTORY_LIMIT = 20;
    const { data: history, error: historyError } = await supabase
      .from("chat_messages")
      .select("role,content,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);

    if (historyError) {
      logError(historyError, { api: "/api/chat/stream", step: "load_history" });
      return NextResponse.json(
        { error: sanitizeDatabaseError(historyError) },
        { status: 500 },
      );
    }

    // 히스토리를 모델 메시지 형식으로 변환
    const historyMessages: ChatMessageForModel[] = (history ?? []).map((m) => ({
      role: m.role as ChatMessageForModel["role"],
      content: m.content as string,
    }));

    // 시스템 프롬프트를 맨 앞에 추가 (챗봇이 또또앙스 쇼핑몰 역할을 제대로 하도록)
    const modelMessages: ChatMessageForModel[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMessages,
    ];

    const MODEL_NAME = "gemini-2.5-flash";

    // 5) SSE 스트리밍 응답
    let assistantText = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(sseEvent("start", { ok: true })));

          for await (const delta of streamGeminiText({
            model: MODEL_NAME,
            messages: modelMessages,
          })) {
            assistantText += delta;
            controller.enqueue(encoder.encode(sseEvent("token", { delta })));
          }

          // 6) assistant 메시지 저장 (스트리밍 완료 후)
          if (assistantText.trim()) {
            const { error: insertAssistantError } = await supabase
              .from("chat_messages")
              .insert({ session_id: sessionId, role: "assistant", content: assistantText });

            if (insertAssistantError) {
              logger.error("[POST /api/chat/stream] assistant 메시지 저장 실패", insertAssistantError);
            }
          }

          controller.enqueue(
            encoder.encode(sseEvent("done", { message: assistantText })),
          );
          controller.close();
        } catch (err) {
          logger.error("[POST /api/chat/stream] 스트리밍 에러", err);
          controller.enqueue(
            encoder.encode(
              sseEvent("error", {
                error: "stream_failed",
                message: err instanceof Error ? err.message : String(err),
              }),
            ),
          );
          controller.close();
        } finally {
          // assistant 저장은 스트림 종료 직전/직후에 하되,
          // start() 내부에서 await insert를 하면 응답 종료가 지연될 수 있어 최소화합니다.
        }
      },
      async cancel(reason) {
        logger.debug("[POST /api/chat/stream] 클라이언트 스트림 취소", { reason });
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    logError(e, { api: "/api/chat/stream", step: "unexpected_error" });
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}


