/**
 * @file scripts/delete-hidden-products.ts
 * @description 숨김 처리된 상품 삭제 스크립트
 * 
 * 실행 방법:
 * pnpm tsx scripts/delete-hidden-products.ts
 * 
 * 환경 변수 필요:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// 환경 변수 확인
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  console.error("필요한 환경 변수:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  console.log("=".repeat(60));
  console.log("숨김 처리된 상품 삭제 시작");
  console.log("=".repeat(60));

  try {
    // 삭제 전 숨김 처리된 상품 수 확인
    console.log("\n[1단계] 삭제 전 숨김 처리된 상품 수 확인 중...");
    const { count: beforeCount, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "hidden")
      .is("deleted_at", null);

    if (countError) {
      console.error("❌ 상품 수 확인 실패:", countError);
      process.exit(1);
    }

    console.log(`✅ 삭제 전 숨김 처리된 상품 수: ${beforeCount}개`);

    if (!beforeCount || beforeCount === 0) {
      console.log("\n✅ 삭제할 숨김 처리된 상품이 없습니다.");
      return;
    }

    // 숨김 처리된 상품 삭제
    console.log(`\n[2단계] ${beforeCount}개 상품 삭제 중...`);
    const { data, error } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("status", "hidden")
      .is("deleted_at", null)
      .select("id, name");

    if (error) {
      console.error("❌ 상품 삭제 실패:", error);
      process.exit(1);
    }

    const deletedCount = data?.length || 0;
    console.log(`✅ 삭제된 상품 수: ${deletedCount}개`);

    if (data && data.length > 0 && data.length <= 10) {
      console.log("\n삭제된 상품 목록:");
      data.forEach((p, index) => {
        console.log(`  ${index + 1}. ${p.name} (ID: ${p.id})`);
      });
    } else if (data && data.length > 10) {
      console.log("\n삭제된 상품 목록 (처음 10개):");
      data.slice(0, 10).forEach((p, index) => {
        console.log(`  ${index + 1}. ${p.name} (ID: ${p.id})`);
      });
      console.log(`  ... 외 ${data.length - 10}개`);
    }

    // 삭제 후 확인
    console.log("\n[3단계] 삭제 후 확인 중...");
    const { count: afterCount, error: afterError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "hidden")
      .is("deleted_at", null);

    if (afterError) {
      console.error("❌ 삭제 후 확인 실패:", afterError);
    } else {
      console.log(`✅ 삭제 후 남은 숨김 처리된 상품 수: ${afterCount}개`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ 숨김 처리된 상품 삭제가 완료되었습니다.");
    console.log(`   총 ${deletedCount}개 상품이 삭제 처리되었습니다.`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ 예외 발생:", error);
    if (error instanceof Error) {
      console.error("에러 메시지:", error.message);
      console.error("스택:", error.stack);
    }
    process.exit(1);
  }
}

main();
