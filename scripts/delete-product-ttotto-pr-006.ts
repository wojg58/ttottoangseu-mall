/**
 * @file scripts/delete-product-ttotto-pr-006.ts
 * @description ttotto_pr_006 상품 삭제 스크립트
 * 
 * 실행 방법:
 * pnpm tsx scripts/delete-product-ttotto-pr-006.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  const productId = "ttotto_pr_006";
  
  console.log("=".repeat(60));
  console.log(`상품 삭제 처리: ${productId}`);
  console.log("=".repeat(60));

  try {
    // 삭제 전 확인
    console.log("\n[1단계] 삭제 전 상품 정보 확인 중...");
    const { data: beforeData, error: beforeError } = await supabase
      .from("products")
      .select("id, name, status, stock, smartstore_product_id, deleted_at")
      .eq("id", productId)
      .single();

    if (beforeError) {
      console.error("❌ 상품 조회 실패:", beforeError);
      process.exit(1);
    }

    if (!beforeData) {
      console.error(`❌ 상품을 찾을 수 없습니다: ${productId}`);
      process.exit(1);
    }

    if (beforeData.deleted_at) {
      console.log("⚠️ 이미 삭제된 상품입니다.");
      console.log("삭제일시:", beforeData.deleted_at);
      return;
    }

    console.log("✅ 상품 정보:");
    console.log(`  - ID: ${beforeData.id}`);
    console.log(`  - 이름: ${beforeData.name}`);
    console.log(`  - 상태: ${beforeData.status}`);
    console.log(`  - 재고: ${beforeData.stock}`);
    console.log(`  - 스마트스토어 ID: ${beforeData.smartstore_product_id || "없음"}`);

    // 상품 삭제 처리
    console.log(`\n[2단계] 상품 삭제 처리 중...`);
    const { data: updateData, error: updateError } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .is("deleted_at", null)
      .select("id, name, deleted_at")
      .single();

    if (updateError) {
      console.error("❌ 상품 삭제 실패:", updateError);
      process.exit(1);
    }

    if (!updateData) {
      console.error("❌ 삭제된 상품 데이터를 가져올 수 없습니다.");
      process.exit(1);
    }

    console.log("✅ 상품 삭제 완료!");
    console.log(`  - ID: ${updateData.id}`);
    console.log(`  - 이름: ${updateData.name}`);
    console.log(`  - 삭제일시: ${updateData.deleted_at}`);

    // 삭제 후 확인
    console.log("\n[3단계] 삭제 후 확인 중...");
    const { data: afterData } = await supabase
      .from("products")
      .select("id, name, deleted_at")
      .eq("id", productId)
      .single();

    if (afterData?.deleted_at) {
      console.log("✅ 삭제 확인 완료 - 홈화면에서 제거되었습니다.");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ 작업 완료");
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
