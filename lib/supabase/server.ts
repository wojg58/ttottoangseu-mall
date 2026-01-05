import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

/**
 * Clerk + Supabase 네이티브 통합 클라이언트 (Server Component용)
 *
 * 2025년 4월부터 권장되는 방식:
 * - JWT 템플릿 불필요
 * - Clerk 토큰을 Supabase가 자동 검증
 * - auth().getToken()으로 현재 세션 토큰 사용
 *
 * @example
 * ```tsx
 * // Server Component / Server Action
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function MyPage() {
 *   const supabase = await createClient();
 *   const { data } = await supabase.from('table').select('*');
 *   return <div>...</div>;
 * }
 * ```
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    async accessToken() {
      return (await auth()).getToken();
    },
  });
}

/**
 * 공개 데이터용 Supabase 클라이언트 (Server Component용)
 * 
 * 인증 없이 공개 데이터에 접근할 때 사용합니다.
 * 예: 상품 목록, 카테고리 목록 등 모든 사용자가 볼 수 있는 데이터
 * 
 * @example
 * ```tsx
 * // Server Component / Server Action
 * import { createPublicClient } from '@/lib/supabase/server';
 *
 * export default async function ProductsPage() {
 *   const supabase = createPublicClient();
 *   const { data } = await supabase.from('products').select('*');
 *   return <div>...</div>;
 * }
 * ```
 */
export function createPublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(supabaseUrl, supabaseKey);
}

// 하위 호환성을 위한 alias
export const createClerkSupabaseClient = createClient;
