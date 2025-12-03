/**
 * @file actions/import-products.ts
 * @description 상품 일괄 이관 Server Actions
 *
 * 주요 기능:
 * 1. 파싱된 상품 데이터를 실제 DB에 저장
 * 2. 카테고리 매핑 처리
 * 3. 이미지 URL 저장 (이미지 업로드는 별도 처리)
 * 4. 옵션 정보 저장
 */

"use server";

import { isAdmin } from "./admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ParsedProductData } from "@/lib/utils/import-products";
import type { CreateProductInput } from "./admin-products";
import { uploadImagesFromUrls } from "@/lib/utils/upload-image";

// 상품 일괄 생성 결과
export interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  failed: number;
  errors: Array<{
    product_name: string;
    message: string;
  }>;
}

/**
 * 파싱된 상품 데이터를 실제 DB에 저장
 */
export async function importProducts(
  products: ParsedProductData[],
): Promise<ImportResult> {
  console.group("[importProducts] 상품 일괄 이관 시작");
  console.log("이관할 상품 수:", products.length);

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return {
      success: false,
      message: "관리자 권한이 필요합니다.",
      imported: 0,
      failed: products.length,
      errors: [],
    };
  }

  const supabase = await createClient();
  let imported = 0;
  let failed = 0;
  const errors: ImportResult["errors"] = [];

  // 카테고리 목록 조회 (slug로 매핑)
  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug")
    .is("deleted_at", null);

  const categoryMap = new Map<string, string>();
  categories?.forEach((cat) => {
    categoryMap.set(cat.slug, cat.id);
  });

  console.log("카테고리 매핑:", categoryMap.size, "개");

  // 각 상품 처리
  for (const productData of products) {
    try {
      console.log(`[importProducts] 상품 처리 중: ${productData.name}`);

      // 카테고리 ID 찾기
      let categoryId: string | null = null;
      if (productData.category_slug) {
        categoryId = categoryMap.get(productData.category_slug) || null;
      }

      // 카테고리가 없으면 첫 번째 카테고리 사용 (또는 에러)
      if (!categoryId && categories && categories.length > 0) {
        categoryId = categories[0].id;
        console.log(
          `카테고리 매핑 실패, 기본 카테고리 사용: ${productData.name}`,
        );
      }

      if (!categoryId) {
        errors.push({
          product_name: productData.name,
          message: "카테고리를 찾을 수 없습니다.",
        });
        failed++;
        continue;
      }

      // slug 중복 확인
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("slug", productData.slug)
        .is("deleted_at", null)
        .single();

      if (existing) {
        // slug가 중복되면 타임스탬프 추가
        const newSlug = `${productData.slug}-${Date.now()}`;
        productData.slug = newSlug;
        console.log(`slug 중복, 새 slug 사용: ${newSlug}`);
      }

      // 상품 생성 입력 데이터 준비
      const createInput: CreateProductInput = {
        category_id: categoryId,
        name: productData.name,
        slug: productData.slug,
        price: productData.price,
        discount_price: productData.discount_price,
        description: productData.description,
        status: productData.status,
        stock: productData.stock,
        is_featured: productData.is_featured,
        is_new: productData.is_new,
        images: productData.image_urls.map((url, index) => ({
          image_url: url,
          is_primary: index === 0,
          sort_order: index,
          alt_text: productData.name,
        })),
      };

      // 상품 생성
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          category_id: createInput.category_id,
          name: createInput.name,
          slug: createInput.slug,
          price: createInput.price,
          discount_price: createInput.discount_price,
          description: createInput.description,
          status: createInput.status,
          stock: createInput.stock,
          is_featured: createInput.is_featured,
          is_new: createInput.is_new,
        })
        .select("id")
        .single();

      if (productError || !product) {
        console.error(`상품 생성 실패: ${productData.name}`, productError);
        errors.push({
          product_name: productData.name,
          message: `상품 생성 실패: ${
            productError?.message || "알 수 없는 오류"
          }`,
        });
        failed++;
        continue;
      }

      // 이미지 업로드 및 저장
      if (createInput.images && createInput.images.length > 0) {
        console.log(
          `이미지 업로드 시작: ${productData.name} (${createInput.images.length}개)`,
        );

        // 외부 URL에서 이미지 다운로드 및 Supabase Storage에 업로드
        const imageUrls = createInput.images.map((img) => img.image_url);
        const uploadResult = await uploadImagesFromUrls(imageUrls);

        // 업로드된 이미지 URL 사용 (실패한 경우 원본 URL 사용)
        const finalImageUrls = createInput.images.map((img, index) => {
          const uploaded = uploadResult.uploaded.find(
            (u) => u.originalUrl === img.image_url,
          );
          return uploaded ? uploaded.uploadedUrl : img.image_url;
        });

        const imageData = finalImageUrls.map((url, index) => ({
          product_id: product.id,
          image_url: url,
          is_primary: createInput.images![index].is_primary,
          sort_order: createInput.images![index].sort_order,
          alt_text: createInput.images![index].alt_text || productData.name,
        }));

        const { error: imageError } = await supabase
          .from("product_images")
          .insert(imageData);

        if (imageError) {
          console.error(`이미지 저장 실패: ${productData.name}`, imageError);
          // 이미지는 실패해도 상품은 생성됨
        } else {
          console.log(
            `이미지 저장 성공: ${productData.name} (${imageData.length}개)`,
          );
        }

        // 업로드 실패한 이미지가 있으면 경고
        if (uploadResult.failed.length > 0) {
          console.warn(
            `일부 이미지 업로드 실패: ${productData.name}`,
            uploadResult.failed,
          );
        }
      }

      // 옵션 저장
      if (productData.variants && productData.variants.length > 0) {
        const variantData = productData.variants.map((variant) => ({
          product_id: product.id,
          variant_name: variant.variant_name,
          variant_value: variant.variant_value,
          stock: variant.stock,
          price_adjustment: variant.price_adjustment,
          sku: variant.sku || null,
        }));

        const { error: variantError } = await supabase
          .from("product_variants")
          .insert(variantData);

        if (variantError) {
          console.error(`옵션 저장 실패: ${productData.name}`, variantError);
          // 옵션은 실패해도 상품은 생성됨
        }
      }

      imported++;
      console.log(`상품 생성 성공: ${productData.name}`);
    } catch (error) {
      console.error(`상품 처리 중 에러: ${productData.name}`, error);
      errors.push({
        product_name: productData.name,
        message: `처리 중 오류: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
      });
      failed++;
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");

  console.log(`이관 완료: 성공 ${imported}개, 실패 ${failed}개`);
  console.groupEnd();

  return {
    success: failed === 0,
    message: `${imported}개 상품이 성공적으로 이관되었습니다.${
      failed > 0 ? ` (${failed}개 실패)` : ""
    }`,
    imported,
    failed,
    errors,
  };
}
