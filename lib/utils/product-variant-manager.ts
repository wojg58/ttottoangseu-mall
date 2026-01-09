/**
 * @file lib/utils/product-variant-manager.ts
 * @description 상품 옵션(변형) 관리 유틸리티
 *
 * 상품 옵션의 추가, 업데이트, 삭제 로직을 담당합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface VariantInput {
  id?: string;
  variant_name: string;
  variant_value: string;
  stock: number;
  price_adjustment: number;
  sku?: string | null;
}

/**
 * 상품 옵션 업데이트
 */
export async function updateProductVariants(
  supabase: SupabaseClient,
  productId: string,
  variants: VariantInput[],
): Promise<void> {
  logger.debug("[updateProductVariants] 옵션 업데이트 시작");

  // 기존 옵션 목록 가져오기
  const { data: existingVariants } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .is("deleted_at", null);

  // 전달된 옵션 중 기존 옵션 ID 추출
  const existingVariantIds = variants
    .map((v) => v.id)
    .filter((id): id is string => !!id);

  // 삭제할 옵션 ID (기존에 있지만 전달되지 않은 옵션)
  const variantsToDelete =
    existingVariants?.filter((v) => !existingVariantIds.includes(v.id)) || [];

  // 삭제할 옵션이 있으면 삭제 (soft delete)
  if (variantsToDelete.length > 0) {
    const deleteIds = variantsToDelete.map((v) => v.id);
    const { error: deleteVariantError } = await supabase
      .from("product_variants")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", deleteIds);

    if (deleteVariantError) {
      logger.error("옵션 삭제 에러:", deleteVariantError);
    } else {
      logger.info(`기존 옵션 ${deleteIds.length}개 삭제 완료`);
    }
  }

  // 새로 추가할 옵션과 업데이트할 옵션 분리
  const variantsToInsert: Array<{
    product_id: string;
    variant_name: string;
    variant_value: string;
    stock: number;
    price_adjustment: number;
    sku: string | null;
  }> = [];
  const variantsToUpdate: Array<{
    id: string;
    variant_name?: string;
    variant_value?: string;
    stock?: number;
    price_adjustment?: number;
    sku?: string | null;
  }> = [];

  variants.forEach((variant) => {
    if (variant.id) {
      // 기존 옵션 업데이트
      variantsToUpdate.push({
        id: variant.id,
        variant_name: variant.variant_name,
        variant_value: variant.variant_value,
        stock: variant.stock,
        price_adjustment: variant.price_adjustment,
        sku: variant.sku ?? null,
      });
    } else {
      // 새 옵션 추가
      variantsToInsert.push({
        product_id: productId,
        variant_name: variant.variant_name,
        variant_value: variant.variant_value,
        stock: variant.stock,
        price_adjustment: variant.price_adjustment,
        sku: variant.sku ?? null,
      });
    }
  });

  // 기존 옵션 업데이트
  if (variantsToUpdate.length > 0) {
    for (const variant of variantsToUpdate) {
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          variant_name: variant.variant_name,
          variant_value: variant.variant_value,
          stock: variant.stock,
          price_adjustment: variant.price_adjustment,
          sku: variant.sku,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variant.id);

      if (updateError) {
        logger.error(`옵션 ${variant.id} 업데이트 에러:`, updateError);
      }
    }
    logger.info(`기존 옵션 ${variantsToUpdate.length}개 업데이트 완료`);
  }

  // 새 옵션 추가
  if (variantsToInsert.length > 0) {
    const { error: insertVariantError } = await supabase
      .from("product_variants")
      .insert(variantsToInsert);

    if (insertVariantError) {
      logger.error("옵션 추가 에러:", insertVariantError);
    } else {
      logger.info(`새 옵션 ${variantsToInsert.length}개 추가 완료`);
    }
  }

  logger.info("[updateProductVariants] 옵션 업데이트 완료");
}

