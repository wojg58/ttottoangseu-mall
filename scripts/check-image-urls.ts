/**
 * @file scripts/check-image-urls.ts
 * @description 특정 상품의 이미지 URL 형식 확인 스크립트
 * 
 * 실행 방법:
 * pnpm tsx scripts/check-image-urls.ts "상품명"
 */

import { config } from "dotenv";
import { resolve } from "path";

// 환경 변수 로드
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  extractFilePathFromUrl,
  extractBucketFromUrl,
} from "@/lib/utils/storage-url";

async function checkImageUrls(productName?: string) {
  console.log("=".repeat(60));
  console.log("상품 이미지 URL 형식 확인");
  console.log("=".repeat(60));

  const supabase = getServiceRoleClient();

  try {
    let query = supabase
      .from("products")
      .select(`
        id,
        name,
        images:product_images(id, image_url, is_primary, sort_order)
      `)
      .is("deleted_at", null);

    if (productName) {
      query = query.ilike("name", `%${productName}%`);
    }

    const { data: products, error } = await query.limit(10);

    if (error) {
      throw new Error(`상품 조회 실패: ${error.message}`);
    }

    if (!products || products.length === 0) {
      console.log("\n상품을 찾을 수 없습니다.");
      return;
    }

    console.log(`\n총 ${products.length}개 상품 발견\n`);

    for (const product of products) {
      console.log(`\n상품: ${product.name} (ID: ${product.id})`);
      console.log("-".repeat(60));

      const images = (product as any).images || [];
      console.log(`이미지 개수: ${images.length}개\n`);

      for (const image of images) {
        console.log(`  이미지 ID: ${image.id}`);
        console.log(`  URL: ${image.image_url}`);
        
        const filePath = extractFilePathFromUrl(image.image_url);
        const bucketName = extractBucketFromUrl(image.image_url);
        
        console.log(`  추출된 경로: ${filePath || "추출 실패"}`);
        console.log(`  추출된 버킷: ${bucketName || "추출 실패"}`);
        
        if (filePath && bucketName) {
          console.log(`  ✅ Supabase Storage 파일 (삭제 가능)`);
        } else if (image.image_url.includes("shop-phinf.pstatic.net")) {
          console.log(`  ⚠ 네이버 스마트스토어 URL (외부 URL, Storage에 없음)`);
        } else {
          console.log(`  ❌ 알 수 없는 URL 형식`);
        }
        
        console.log(`  대표 이미지: ${image.is_primary ? "예" : "아니오"}`);
        console.log(`  정렬 순서: ${image.sort_order}`);
        console.log("");
      }
    }
  } catch (error) {
    console.error("\n✗ 오류 발생:", error);
    if (error instanceof Error) {
      console.error("메시지:", error.message);
      console.error("스택:", error.stack);
    }
    process.exit(1);
  }
}

// 스크립트 실행
const productName = process.argv[2];
checkImageUrls(productName)
  .then(() => {
    console.log("\n✓ 스크립트 실행 완료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ 스크립트 실행 실패:", error);
    process.exit(1);
  });

