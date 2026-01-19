/**
 * @file actions/sync-stock.ts
 * @description 네이버 스마트스토어 재고 동기화 Server Action
 *
 * 주요 기능:
 * 1. 네이버 스마트스토어에서 재고 조회
 * 2. Supabase products 테이블에 재고 업데이트
 * 3. 상품 상태 자동 업데이트 (품절 시 sold_out)
 *
 * 동작 방식:
 * - 네이버 스마트스토어 → Supabase (일방향)
 * - 로컬호스트에서 주기적으로 호출하여 동기화
 *
 * @dependencies
 * - lib/utils/smartstore-api.ts: 네이버 스마트스토어 API 클라이언트
 * - lib/supabase/service-role.ts: Supabase 서비스 롤 클라이언트
 */

"use server";

import { getSmartStoreApiClient } from "@/lib/utils/smartstore-api";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

export interface SyncStockResult {
  success: boolean;
  message: string;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ productId: string; error: string }>;
}

export interface SyncVariantStockResult {
  success: boolean;
  message: string;
  syncedCount: number;
  failedCount: number;
  errors: Array<{
    variantId: string;
    optionId: number;
    error: string;
  }>;
}

/**
 * 단일 상품 재고 동기화
 */
export async function syncProductStock(
  smartstoreProductId: string,
): Promise<{ success: boolean; message: string; stock?: number }> {
  try {
    // 1. Supabase에서 해당 상품 조회
    const supabase = getServiceRoleClient();
    const { data: product, error: findError } = await supabase
      .from("products")
      .select("id, name, stock, status")
      .eq("smartstore_product_id", smartstoreProductId)
      .eq("deleted_at", null)
      .single();

    if (findError || !product) {
      logger.error("[syncProductStock] 상품을 찾을 수 없습니다", findError);
      return {
        success: false,
        message: `상품을 찾을 수 없습니다: ${smartstoreProductId}`,
      };
    }

    // 2. 네이버 스마트스토어에서 재고 조회
    const apiClient = getSmartStoreApiClient();
    const smartstoreProduct = await apiClient.getProduct(smartstoreProductId);

    if (!smartstoreProduct) {
      logger.error(
        "[syncProductStock] 네이버 스마트스토어에서 상품 정보를 가져올 수 없습니다",
      );
      return {
        success: false,
        message: `네이버 스마트스토어에서 상품 정보를 가져올 수 없습니다: ${smartstoreProductId}`,
      };
    }

    // 3. 재고 및 상태 업데이트
    const newStock = smartstoreProduct.stockQuantity;
    let newStatus: "active" | "hidden" | "sold_out" = product.status as
      | "active"
      | "hidden"
      | "sold_out";

    // 재고가 0이면 품절 상태로 변경
    if (newStock === 0 && newStatus !== "hidden") {
      newStatus = "sold_out";
    } else if (newStock > 0 && newStatus === "sold_out") {
      // 재고가 생기면 판매중으로 복구
      newStatus = "active";
    }

    const updateData: {
      stock: number;
      status?: "active" | "hidden" | "sold_out";
    } = {
      stock: newStock,
    };

    if (newStatus !== product.status) {
      updateData.status = newStatus;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", product.id);

    if (updateError) {
      logger.error("[syncProductStock] 재고 업데이트 실패", updateError);
      return {
        success: false,
        message: `재고 업데이트 실패: ${updateError.message}`,
      };
    }

    logger.info("[syncProductStock] 재고 동기화 완료", {
      productName: product.name,
      oldStock: product.stock,
      newStock,
    });

    return {
      success: true,
      message: `재고 동기화 완료: ${newStock}개`,
      stock: newStock,
    };
  } catch (error) {
    logger.error("[syncProductStock] 예외 발생", error);
    return {
      success: false,
      message: `재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    };
  }
}

/**
 * 모든 상품 재고 동기화 (판매중인 상품만, smartstore_product_id가 있는 상품만)
 */
export async function syncAllStocks(): Promise<SyncStockResult> {
  const result: SyncStockResult = {
    success: true,
    message: "",
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // 1. Supabase에서 동기화 대상 상품 조회 (판매중인 상품만)
    const supabase = getServiceRoleClient();
    const { data: products, error: findError } = await supabase
      .from("products")
      .select("id, name, smartstore_product_id")
      .not("smartstore_product_id", "is", null)
      .is("deleted_at", null)
      .eq("status", "active"); // 판매중인 상품만 동기화

    if (findError) {
      logger.error("[syncAllStocks] 상품 조회 실패", findError);
      result.success = false;
      result.message = `상품 조회 실패: ${findError.message}`;
      return result;
    }

    if (!products || products.length === 0) {
      logger.debug("[syncAllStocks] 동기화 대상 상품 없음");
      result.message = "동기화 대상 상품이 없습니다";
      return result;
    }

    logger.debug("[syncAllStocks] 동기화 시작", {
      count: products.length,
    });

    // 2. 각 상품의 재고 동기화
    for (const product of products) {
      if (!product.smartstore_product_id) continue;

      const syncResult = await syncProductStock(
        product.smartstore_product_id,
      );

      if (syncResult.success) {
        result.syncedCount++;
      } else {
        result.failedCount++;
        result.errors.push({
          productId: product.smartstore_product_id,
          error: syncResult.message,
        });
      }

      // API 레이트 리밋 방지를 위한 짧은 대기 (마지막 상품 제외)
      if (product !== products[products.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    result.message = `재고 동기화 완료: 성공 ${result.syncedCount}개, 실패 ${result.failedCount}개`;
    logger.info("[syncAllStocks] 동기화 완료", {
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
    });

    return result;
  } catch (error) {
    logger.error("[syncAllStocks] 예외 발생", error);
    result.success = false;
    result.message = `재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    return result;
  }
}

/**
 * 옵션 단위 재고 동기화 (스마트스토어 → 자사몰)
 * 
 * @param smartstoreProductId 채널상품 번호 (products.smartstore_product_id 값)
 * @returns 동기화 결과
 */
export async function syncVariantStocks(
  smartstoreProductId: string,
): Promise<SyncVariantStockResult> {
  const result: SyncVariantStockResult = {
    success: true,
    message: "",
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    const supabase = getServiceRoleClient();
    const apiClient = getSmartStoreApiClient();

    // 1. Supabase에서 해당 상품 조회
    const { data: product, error: findError } = await supabase
      .from("products")
      .select("id, name")
      .eq("smartstore_product_id", smartstoreProductId)
      .is("deleted_at", null)
      .single();

    if (findError || !product) {
      logger.error("[syncVariantStocks] 상품을 찾을 수 없습니다", findError);
      result.success = false;
      result.message = `상품을 찾을 수 없습니다: ${smartstoreProductId}`;
      return result;
    }

    // 2. 스마트스토어에서 채널 상품 조회 (옵션 정보 포함)
    const channelProduct = await apiClient.getChannelProduct(
      smartstoreProductId,
    );

    if (!channelProduct) {
      logger.error("[syncVariantStocks] 스마트스토어 상품 조회 실패");
      result.success = false;
      result.message = `스마트스토어 상품 조회 실패: ${smartstoreProductId}`;
      return result;
    }

    // 3. 옵션별 재고 목록 추출
    const options = apiClient.extractOptionStocks(channelProduct);

    if (options.length === 0) {
      logger.warn(
        "[syncVariantStocks] 옵션이 없거나 재고관리를 사용하지 않는 상품",
      );
      result.message = "옵션이 없거나 재고관리를 사용하지 않는 상품입니다";
      return result;
    }

    logger.debug("[syncVariantStocks] 옵션 발견", {
      count: options.length,
    });

    // 4. originProductNo 확인
    // 우선순위: 1) 채널 상품 조회 응답, 2) DB 매핑 정보
    let originProductNo: number | null = null;

    // 1차: 채널 상품 조회 응답에서 가져오기
    if (channelProduct.originProductNo) {
      originProductNo = channelProduct.originProductNo;
    } else {
      // 2차: DB에서 기존 매핑 정보 사용
      const { data: existingVariants } = await supabase
        .from("product_variants")
        .select("id, smartstore_origin_product_no, smartstore_option_id")
        .eq("product_id", product.id)
        .not("smartstore_origin_product_no", "is", null)
        .is("deleted_at", null)
        .limit(1);

      if (existingVariants && existingVariants.length > 0) {
        originProductNo = existingVariants[0].smartstore_origin_product_no;
      }
    }

    if (!originProductNo) {
      logger.warn(
        "[syncVariantStocks] originProductNo를 찾을 수 없습니다. 매핑 빌드 작업을 먼저 실행하세요.",
      );
      // originProductNo 없이도 SKU로 매핑 시도 가능
    }

    // 5. 각 옵션별로 우리 DB의 variant 찾아서 재고 업데이트
    for (const option of options) {
      let variant = null;

      // originProductNo가 있으면 복합키로 매칭
      if (originProductNo) {
        const { data: foundVariant, error: findVariantError } =
          await supabase
            .from("product_variants")
            .select("id, stock, sku, variant_value")
            .eq("product_id", product.id)
            .eq("smartstore_origin_product_no", originProductNo)
            .eq("smartstore_option_id", option.id)
            .is("deleted_at", null)
            .single();

        if (!findVariantError && foundVariant) {
          variant = foundVariant;
        }
      }

      // 매핑 실패 시 SKU로 매칭 시도
      if (!variant && option.sellerManagerCode) {
        const { data: foundVariant, error: findVariantError } =
          await supabase
            .from("product_variants")
            .select("id, stock, sku, variant_value")
            .eq("product_id", product.id)
            .eq("sku", option.sellerManagerCode)
            .is("deleted_at", null)
            .single();

        if (!findVariantError && foundVariant) {
          variant = foundVariant;
          // 매핑 정보 업데이트
          await supabase
            .from("product_variants")
            .update({
              smartstore_origin_product_no: originProductNo,
              smartstore_option_id: option.id,
              smartstore_channel_product_no: channelProduct.channelProductNo,
            })
            .eq("id", variant.id);
        }
      }

      if (!variant) {
        result.failedCount++;
        result.errors.push({
          variantId: "unknown",
          optionId: option.id,
          error: `매핑된 variant 없음 (옵션: ${option.optionName1}${option.optionName2 ? `/${option.optionName2}` : ""})`,
        });
        logger.warn(
          `[syncVariantStocks] 매핑 실패: ${option.optionName1}${option.optionName2 ? `/${option.optionName2}` : ""}`,
        );
        continue;
      }

      // 재고 업데이트
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ stock: option.stockQuantity })
        .eq("id", variant.id);

      if (updateError) {
        result.failedCount++;
        result.errors.push({
          variantId: variant.id,
          optionId: option.id,
          error: updateError.message,
        });
        logger.error(
          `[syncVariantStocks] 재고 업데이트 실패: ${variant.id}`,
          updateError,
        );
      } else {
        result.syncedCount++;
      }
    }

    result.message = `옵션 재고 동기화 완료: 성공 ${result.syncedCount}개, 실패 ${result.failedCount}개`;
    logger.info("[syncVariantStocks] 동기화 완료", {
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
    });

    return result;
  } catch (error) {
    logger.error("[syncVariantStocks] 예외 발생", error);
    result.success = false;
    result.message = `옵션 재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    return result;
  }
}

/**
 * 전체 상품 옵션 재고 동기화 (판매중인 상품만)
 */
export async function syncAllVariantStocks(): Promise<SyncVariantStockResult> {
  const totalResult: SyncVariantStockResult = {
    success: true,
    message: "",
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    const supabase = getServiceRoleClient();

    // 스마트스토어 연동된 상품 조회 (판매중인 상품만)
    const { data: products, error: findError } = await supabase
      .from("products")
      .select("smartstore_product_id")
      .not("smartstore_product_id", "is", null)
      .is("deleted_at", null)
      .eq("status", "active"); // 판매중인 상품만 동기화

    if (findError) {
      logger.error("[syncAllVariantStocks] 상품 조회 실패", findError);
      totalResult.success = false;
      totalResult.message = `상품 조회 실패: ${findError.message}`;
      return totalResult;
    }

    if (!products || products.length === 0) {
      totalResult.message = "동기화 대상 상품 없음";
      logger.debug("[syncAllVariantStocks] 동기화 대상 상품 없음");
      return totalResult;
    }

    logger.debug("[syncAllVariantStocks] 동기화 시작", {
      count: products.length,
    });

    for (const product of products) {
      if (!product.smartstore_product_id) continue;

      const result = await syncVariantStocks(product.smartstore_product_id);

      totalResult.syncedCount += result.syncedCount;
      totalResult.failedCount += result.failedCount;
      totalResult.errors.push(...result.errors);

      // API 레이트 리밋 방지
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    totalResult.message = `전체 옵션 재고 동기화 완료: 성공 ${totalResult.syncedCount}개, 실패 ${totalResult.failedCount}개`;
    logger.info("[syncAllVariantStocks] 동기화 완료", {
      syncedCount: totalResult.syncedCount,
      failedCount: totalResult.failedCount,
    });

    return totalResult;
  } catch (error) {
    logger.error("[syncAllVariantStocks] 예외 발생", error);
    totalResult.success = false;
    totalResult.message = `전체 옵션 재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    return totalResult;
  }
}




