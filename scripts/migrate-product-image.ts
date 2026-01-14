/**
 * @file scripts/migrate-product-image.ts
 * @description 특정 상품의 네이버 스마트스토어 이미지를 Supabase Storage로 마이그레이션
 * 
 * 사용법:
 * pnpm tsx scripts/migrate-product-image.ts <product_id>
 * 
 * 예시:
 * pnpm tsx scripts/migrate-product-image.ts ttotto_pr_092
 */

import { createClient } from "@supabase/supabase-js";
import { uploadImageFromUrl } from "@/lib/utils/upload-image";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  console.error("NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.error("SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrateProductImage(productId: string) {
  console.group(`[migrateProductImage] 상품 이미지 마이그레이션 시작: ${productId}`);

  try {
    // 1. 상품 정보 조회
    console.log("1. 상품 정보 조회 중...");
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, slug")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      console.error("❌ 상품을 찾을 수 없습니다:", productError);
      return;
    }

    console.log("✅ 상품 정보:", product.name);

    // 2. 상품 이미지 조회
    console.log("2. 상품 이미지 조회 중...");
    const { data: images, error: imagesError } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true });

    if (imagesError) {
      console.error("❌ 이미지 조회 실패:", imagesError);
      return;
    }

    if (!images || images.length === 0) {
      console.warn("⚠️ 이미지가 없습니다.");
      return;
    }

    console.log(`✅ ${images.length}개의 이미지 발견`);

    // 3. 각 이미지 URL 확인 및 마이그레이션
    for (const image of images) {
      console.log(`\n3. 이미지 처리 중: ${image.id}`);
      console.log("   현재 URL:", image.image_url);

      // 이미 Supabase Storage URL인 경우 스킵
      if (image.image_url?.includes("supabase.co")) {
        console.log("   ✅ 이미 Supabase Storage URL입니다. 스킵합니다.");
        continue;
      }

      // 네이버 스마트스토어 URL인 경우 마이그레이션
      if (
        image.image_url?.includes("phinf.naver.net") ||
        image.image_url?.includes("shop-phinf.pstatic.net")
      ) {
        console.log("   📥 네이버 스마트스토어 이미지 발견. Supabase Storage로 업로드 중...");

        try {
          // HTTP를 HTTPS로 변환 시도
          let imageUrl = image.image_url;
          if (imageUrl.startsWith("http://")) {
            imageUrl = imageUrl.replace("http://", "https://");
            console.log("   🔄 HTTPS로 변환:", imageUrl);
          }

          // 이미지 업로드
          const uploadResult = await uploadImageFromUrl(
            imageUrl,
            `product-${productId}-${image.id}.webp`
          );

          if (uploadResult.success && uploadResult.url) {
            console.log("   ✅ 업로드 성공:", uploadResult.url);

            // 데이터베이스 업데이트
            const { error: updateError } = await supabase
              .from("product_images")
              .update({ image_url: uploadResult.url })
              .eq("id", image.id);

            if (updateError) {
              console.error("   ❌ 데이터베이스 업데이트 실패:", updateError);
            } else {
              console.log("   ✅ 데이터베이스 업데이트 완료");
            }
          } else {
            console.error("   ❌ 업로드 실패:", uploadResult.error);
          }
        } catch (error) {
          console.error("   ❌ 이미지 처리 중 오류:", error);
        }
      } else {
        console.log("   ⚠️ 알 수 없는 이미지 URL 형식입니다. 스킵합니다.");
      }
    }

    console.log("\n✅ 마이그레이션 완료!");
    console.groupEnd();
  } catch (error) {
    console.error("❌ 마이그레이션 실패:", error);
    console.groupEnd();
  }
}

// 명령줄 인자에서 product_id 가져오기
const productId = process.argv[2];

if (!productId) {
  console.error("❌ 사용법: pnpm tsx scripts/migrate-product-image.ts <product_id>");
  console.error("예시: pnpm tsx scripts/migrate-product-image.ts ttotto_pr_092");
  process.exit(1);
}

migrateProductImage(productId)
  .then(() => {
    console.log("\n✅ 스크립트 실행 완료");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 스크립트 실행 실패:", error);
    process.exit(1);
  });
