/**
 * @file lib/utils/product-category-manager.ts
 * @description 상품 카테고리 관리 유틸리티
 *
 * 상품의 다중 카테고리 관계를 관리합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * 상품 카테고리 업데이트
 */
export async function updateProductCategories(
  supabase: SupabaseClient,
  productId: string,
  categoryIds: string[],
): Promise<void> {
  logger.debug("[updateProductCategories] 카테고리 업데이트 시작");

  // 기존 카테고리 관계 삭제
  const { error: deleteError } = await supabase
    .from("product_categories")
    .delete()
    .eq("product_id", productId);

  if (deleteError) {
    logger.error("기존 카테고리 삭제 에러:", deleteError);
  }

  // 새로운 카테고리 관계 추가
  if (categoryIds.length > 0) {
    const productCategoryData = categoryIds.map((categoryId, index) => ({
      product_id: productId,
      category_id: categoryId,
      is_primary: index === 0, // 첫 번째 카테고리가 기본 카테고리
      sort_order: index,
    }));

    const { error: categoryError } = await supabase
      .from("product_categories")
      .insert(productCategoryData);

    if (categoryError) {
      logger.error("카테고리 업데이트 에러:", categoryError);
    } else {
      logger.info(`카테고리 ${categoryIds.length}개 업데이트 완료`);
    }
  }

  logger.info("[updateProductCategories] 카테고리 업데이트 완료");
}

