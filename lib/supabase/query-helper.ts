/**
 * @file lib/supabase/query-helper.ts
 * @description Supabase 쿼리 헬퍼 함수 (PGRST301 에러 자동 처리)
 * 
 * 부분 인덱스(partial index)를 사용하는 쿼리에서 인증 토큰이 없을 때
 * PGRST301 에러가 발생하므로, 자동으로 service role 클라이언트로 재시도
 */

import { createClient } from "./server";
import { getServiceRoleClient } from "./service-role";
import logger from "@/lib/logger";

/**
 * PGRST301 에러 발생 시 service role 클라이언트로 재시도하는 쿼리 래퍼
 */
export async function queryWithRetry<T>(
  queryFn: (supabase: any) => Promise<{ data: T | null; error: any }>,
): Promise<{ data: T | null; error: any }> {
  const supabase = await createClient();
  const result = await queryFn(supabase);

  // PGRST301 에러 발생 시 service role 클라이언트로 재시도
  if (result.error && result.error.code === "PGRST301") {
    logger.warn(
      "[queryWithRetry] PGRST301 에러 발생 - service role 클라이언트로 재시도",
    );
    const serviceSupabase = getServiceRoleClient();
    return await queryFn(serviceSupabase);
  }

  return result;
}

