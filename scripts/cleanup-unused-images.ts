/**
 * @file scripts/cleanup-unused-images.ts
 * @description 사용되지 않는 Supabase Storage 이미지 파일 삭제 스크립트
 * 
 * 실행 방법:
 * pnpm tsx scripts/cleanup-unused-images.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// 환경 변수 로드
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Supabase Storage URL에서 파일 경로를 추출합니다.
 */
function extractFilePathFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // /storage/v1/object/public/product-images/ 또는 /storage/v1/object/sign/product-images/ 경로에서 파일 경로 추출
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/product-images\/(.+)$/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
    return null;
  } catch (error) {
    console.error("[extractFilePathFromUrl] URL 파싱 에러:", error);
    return null;
  }
}

async function cleanupUnusedImages() {
  console.log("=".repeat(60));
  console.log("사용되지 않는 이미지 파일 정리 시작");
  console.log("=".repeat(60));

  const supabase = getServiceRoleClient();

  try {
    // 1. 데이터베이스에서 사용 중인 이미지 URL 조회
    console.log("\n[1단계] 데이터베이스에서 사용 중인 이미지 조회 중...");
    
    const { data: productImages, error: productImagesError } = await supabase
      .from("product_images")
      .select("image_url");

    if (productImagesError) {
      throw new Error(`상품 이미지 조회 실패: ${productImagesError.message}`);
    }

    console.log(`✓ 상품 이미지 ${productImages?.length || 0}개 발견`);

    // 사용 중인 파일 경로 집합 생성
    const usedFilePaths = new Set<string>();

    // product_images의 이미지 URL에서 파일 경로 추출
    if (productImages) {
      for (const image of productImages) {
        if (image.image_url) {
          const filePath = extractFilePathFromUrl(image.image_url);
          if (filePath) {
            usedFilePaths.add(filePath);
            console.log(`  - 사용 중: ${filePath}`);
          } else {
            console.warn(`  ⚠ 파일 경로 추출 실패: ${image.image_url}`);
          }
        }
      }
    }

    // product_variants에 이미지 필드가 있는지 확인 (옵션별 이미지)
    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("id, variant_value")
      .is("deleted_at", null);

    if (variantsError) {
      console.warn(`⚠ 옵션 조회 실패: ${variantsError.message}`);
    } else {
      console.log(`✓ 옵션 ${variants?.length || 0}개 확인 (이미지 필드 없음)`);
    }

    console.log(`\n총 사용 중인 파일: ${usedFilePaths.size}개`);

    // 2. Supabase Storage에서 모든 파일 목록 조회
    console.log("\n[2단계] Supabase Storage에서 파일 목록 조회 중...");

    // product-images 버킷 확인
    const { data: productImagesFiles, error: productImagesListError } = await supabase.storage
      .from("product-images")
      .list("", {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

    if (productImagesListError) {
      console.warn(`⚠ product-images 버킷 조회 실패: ${productImagesListError.message}`);
    } else {
      console.log(`✓ product-images 버킷에서 ${productImagesFiles?.length || 0}개 파일 발견`);
    }

    // uploads 버킷은 다른 용도로 사용될 수 있으므로 제외

    // 3. 사용되지 않는 파일 찾기
    console.log("\n[3단계] 사용되지 않는 파일 찾는 중...");

    const filesToDelete: Array<{ bucket: string; path: string }> = [];

    // product-images 버킷의 파일 확인
    if (productImagesFiles) {
      for (const file of productImagesFiles) {
        const filePath = file.name;
        if (!usedFilePaths.has(filePath)) {
          filesToDelete.push({ bucket: "product-images", path: filePath });
          console.log(`  - 삭제 대상: product-images/${filePath}`);
        }
      }
    }


    console.log(`\n총 삭제 대상 파일: ${filesToDelete.length}개`);

    if (filesToDelete.length === 0) {
      console.log("\n✓ 삭제할 파일이 없습니다.");
      return;
    }

    // 4. 파일 삭제
    console.log("\n[4단계] 파일 삭제 중...");
    console.log("⚠ 주의: 이 작업은 되돌릴 수 없습니다!\n");

    let deletedCount = 0;
    let failedCount = 0;

    // 버킷별로 그룹화
    const filesByBucket = filesToDelete.reduce((acc, file) => {
      if (!acc[file.bucket]) {
        acc[file.bucket] = [];
      }
      acc[file.bucket].push(file.path);
      return acc;
    }, {} as Record<string, string[]>);

    // 각 버킷의 파일 삭제
    for (const [bucket, paths] of Object.entries(filesByBucket)) {
      console.log(`\n${bucket} 버킷에서 ${paths.length}개 파일 삭제 중...`);
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .remove(paths);

      if (error) {
        console.error(`✗ ${bucket} 버킷 삭제 실패:`, error.message);
        failedCount += paths.length;
      } else {
        console.log(`✓ ${bucket} 버킷에서 ${paths.length}개 파일 삭제 완료`);
        deletedCount += paths.length;
      }
    }

    // 결과 출력
    console.log("\n" + "=".repeat(60));
    console.log("정리 완료!");
    console.log("=".repeat(60));
    console.log(`✓ 삭제 성공: ${deletedCount}개`);
    if (failedCount > 0) {
      console.log(`✗ 삭제 실패: ${failedCount}개`);
    }
    console.log(`✓ 유지된 파일: ${usedFilePaths.size}개`);
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
cleanupUnusedImages()
  .then(() => {
    console.log("\n✓ 스크립트 실행 완료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ 스크립트 실행 실패:", error);
    process.exit(1);
  });

