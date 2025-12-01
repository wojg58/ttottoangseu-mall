import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * 인증 불필요한 공개 데이터용 Supabase 클라이언트
 * Client Component에서 사용
 */
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

/**
 * Client Component에서 사용할 Supabase 클라이언트 생성 함수
 * (인증 없이 공개 데이터만 접근)
 */
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}
