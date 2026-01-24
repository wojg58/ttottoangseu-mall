/**
 * @file scripts/get-local-products-ids.ts
 * @description 로컬 사이트에 표시되는 상품 ID 목록 조회 스크립트
 * 
 * 실행 방법:
 * pnpm tsx scripts/get-local-products-ids.ts
 * 
 * 목적: 로컬 사이트 관리자 페이지에 표시되는 상품 ID 목록을 가져와서
 *       SQL 쿼리에서 사용할 수 있도록 출력
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
  console.log("=".repeat(60));
  console.log("로컬 사이트에 표시되는 상품 ID 목록 조회");
  console.log("=".repeat(60));

  try {
    // 관리자 페이지와 동일한 조건으로 상품 조회
    // (deleted_at IS NULL인 모든 상품)
    const { data: products, error, count } = await supabase
      .from("products")
      .select("id, name, status, stock, created_at", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ 상품 조회 실패:", error);
      process.exit(1);
    }

    console.log(`\n✅ 조회된 상품 수: ${count}개`);
    console.log(`   (로컬 사이트에 표시되는 상품 수: 323개여야 함)\n`);

    if (!products || products.length === 0) {
      console.log("조회된 상품이 없습니다.");
      return;
    }

    // SQL 쿼리에서 사용할 수 있는 ID 목록 생성
    console.log("=".repeat(60));
    console.log("SQL 쿼리용 상품 ID 목록:");
    console.log("=".repeat(60));
    console.log("\n-- 유지할 상품 ID 목록 (323개):");
    console.log("-- 다음 ID들을 NOT IN 절에서 제외하세요:\n");

    const idList = products.map((p) => `'${p.id}'`).join(",\n  ");
    console.log(`  ${idList}`);

    // SQL UPDATE 쿼리 예시 출력
    console.log("\n" + "=".repeat(60));
    console.log("삭제 쿼리 예시:");
    console.log("=".repeat(60));
    console.log(`
-- ⚠️ 주의: 이 쿼리를 실행하기 전에 반드시 확인하세요!
-- 현재 조회된 ${count}개 상품 중에서 323개만 유지하고 나머지 삭제

UPDATE products
SET 
  deleted_at = NOW(),
  updated_at = NOW()
WHERE deleted_at IS NULL
  AND id NOT IN (
${idList.split("\n").map((id) => `    ${id}`).join("\n")}
  );
`);

    // 상품 목록 상세 정보 출력 (처음 20개)
    console.log("\n" + "=".repeat(60));
    console.log("상품 목록 (처음 20개):");
    console.log("=".repeat(60));
    products.slice(0, 20).forEach((p, index) => {
      console.log(
        `${index + 1}. ${p.name} (ID: ${p.id}, 상태: ${p.status}, 재고: ${p.stock})`
      );
    });
    if (products.length > 20) {
      console.log(`\n... 외 ${products.length - 20}개`);
    }

    // 상태별 통계
    const statusCounts = products.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("\n" + "=".repeat(60));
    console.log("상태별 상품 수:");
    console.log("=".repeat(60));
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}개`);
    });

    // 파일로 저장할지 물어보기
    console.log("\n" + "=".repeat(60));
    console.log("✅ 조회 완료");
    console.log("=".repeat(60));
    console.log(
      `\n💡 팁: 위의 SQL 쿼리를 복사하여 Supabase SQL Editor에서 실행하세요.`
    );
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
