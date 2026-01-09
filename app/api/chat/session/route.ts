import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  sanitizeDatabaseError,
  logError,
} from "@/lib/error-handler";

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

export async function POST() {
  console.group("[ChatSessionAPI] POST /api/chat/session");
  try {
    const { userId } = await auth();
    console.log("auth:", { userId });

    if (!userId) {
      console.warn("Unauthorized: userId is missing");
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
      console.log("User not found in Supabase. Creating one from Clerk...");
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

    // 3) chat session 생성
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

    console.log("Created session:", session);
    return NextResponse.json({ sessionId: session.id });
  } catch (e) {
    logError(e, { api: "/api/chat/session", step: "unexpected_error" });
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  } finally {
    console.groupEnd();
  }
}


