/**
 * @file actions/member-actions.ts
 * @description 회원 가입 관련 Server Actions
 *
 * 주요 기능:
 * 1. 회원 추가 정보 저장 (Clerk 회원가입 후)
 * 2. 회원 추가 정보 조회
 *
 * @dependencies
 * - Supabase: 회원 추가 정보 저장
 * - Clerk: 사용자 인증
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import logger from "@/lib/logger";
import type { MemberAdditionalInfo } from "@/types/member";

/**
 * 회원 추가 정보 저장
 */
export async function saveMemberAdditionalInfo(
  data: Omit<MemberAdditionalInfo, "clerk_id" | "created_at" | "updated_at">
): Promise<{ success: boolean; error?: string }> {
  try {
    // 현재 로그인한 사용자 확인
    const { userId } = await auth();

    if (!userId) {
      logger.error("[saveMemberAdditionalInfo] 로그인 필요");
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    // 생년월일 조합
    let birth_date: string | undefined;
    if (data.birth_date) {
      birth_date = data.birth_date;
    }

    // 데이터 저장
    const { data: insertedData, error } = await supabase
      .from("member_additional_info")
      .upsert(
        {
          clerk_id: userId,
          member_type: data.member_type,
          company_type: data.company_type,
          hint: data.hint,
          hint_answer: data.hint_answer,
          postcode: data.postcode,
          addr1: data.addr1,
          addr2: data.addr2,
          phone: data.phone,
          mobile: data.mobile,
          gender: data.gender,
          birth_date: birth_date,
          is_solar_calendar: data.is_solar_calendar ?? true,
          is_sms: data.is_sms,
          is_news_mail: data.is_news_mail,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "clerk_id",
        }
      )
      .select();

    if (error) {
      logger.error("[saveMemberAdditionalInfo] DB 저장 실패", error);
      return { success: false, error: "정보 저장에 실패했습니다." };
    }

    logger.info("[saveMemberAdditionalInfo] 저장 완료");
    return { success: true };
  } catch (error) {
    logger.error("[saveMemberAdditionalInfo] 예외 발생", error);
    return { success: false, error: "예상치 못한 오류가 발생했습니다." };
  }
}

/**
 * 회원 추가 정보 조회
 */
export async function getMemberAdditionalInfo(): Promise<{
  success: boolean;
  data?: MemberAdditionalInfo;
  error?: string;
}> {
  try {
    const authResult = await auth();
    const { userId } = authResult;

    if (!userId) {
      logger.error("[getMemberAdditionalInfo] 로그인 필요");
      return { success: false, error: "로그인이 필요합니다." };
    }

    // Clerk 토큰 확인 (PGRST301 에러 방지)
    const token = await authResult.getToken();
    let supabase;

    if (!token) {
      logger.debug("[getMemberAdditionalInfo] 토큰 없음, service role 클라이언트 사용");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );
      supabase = getServiceRoleClient();
    } else {
      supabase = await createClient();
    }

    const { data, error } = await supabase
      .from("member_additional_info")
      .select("*")
      .eq("clerk_id", userId)
      .single();

    // PGRST301 에러 발생 시 service role 클라이언트로 재시도
    if (error && error.code === "PGRST301") {
      logger.debug("[getMemberAdditionalInfo] PGRST301 에러, service role로 재시도");
      const { getServiceRoleClient } = await import(
        "@/lib/supabase/service-role"
      );
      const serviceSupabase = getServiceRoleClient();

      const { data: retryData, error: retryError } = await serviceSupabase
        .from("member_additional_info")
        .select("*")
        .eq("clerk_id", userId)
        .single();

      if (retryError) {
        // PGRST116은 데이터가 없을 때 발생하는 에러
        if (retryError.code === "PGRST116") {
          logger.debug("[getMemberAdditionalInfo] 데이터 없음");
        } else {
          logger.error("[getMemberAdditionalInfo] service role로도 조회 실패", retryError);
        }
        return { success: false, error: "정보를 불러올 수 없습니다." };
      }

      return { success: true, data: retryData as MemberAdditionalInfo };
    }

    if (error) {
      // PGRST116은 데이터가 없을 때 발생하는 에러
      if (error.code === "PGRST116") {
        logger.debug("[getMemberAdditionalInfo] 데이터 없음");
      } else {
        logger.error("[getMemberAdditionalInfo] 조회 실패", error);
      }
      return { success: false, error: "정보를 불러올 수 없습니다." };
    }

    return { success: true, data: data as MemberAdditionalInfo };
  } catch (error) {
    logger.error("[getMemberAdditionalInfo] 예외 발생", error);
    return { success: false, error: "예상치 못한 오류가 발생했습니다." };
  }
}

