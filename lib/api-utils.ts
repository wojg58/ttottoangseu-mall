/**
 * @file lib/api-utils.ts
 * @description API 라우트에서 공통으로 사용하는 유틸리티 함수
 */

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export interface AuthenticatedUser {
  clerkUserId: string;
  supabaseUserId: string;
}

export type AuthResult =
  | {
      success: true;
      user: AuthenticatedUser;
    }
  | {
      success: false;
      response: NextResponse;
    };

/**
 * API 라우트에서 인증된 사용자 정보를 가져옵니다.
 * 인증 실패 시 적절한 에러 응답을 반환합니다.
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error || !user) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }

  return {
    success: true,
    user: {
      clerkUserId,
      supabaseUserId: user.id,
    },
  };
}

/**
 * 에러 응답 생성 헬퍼
 */
export function errorResponse(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ success: false, message }, { status });
}

/**
 * 성공 응답 생성 헬퍼
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}
