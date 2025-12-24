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

/**
 * 단일 상품 재고 동기화
 */
export async function syncProductStock(
  smartstoreProductId: string,
): Promise<{ success: boolean; message: string; stock?: number }> {
  logger.group(
    `[syncProductStock] 재고 동기화 시작: ${smartstoreProductId}`,
  );

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
      logger.error(
        "[syncProductStock] 상품을 찾을 수 없습니다",
        findError,
      );
      logger.groupEnd();
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
      logger.groupEnd();
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
      logger.groupEnd();
      return {
        success: false,
        message: `재고 업데이트 실패: ${updateError.message}`,
      };
    }

    logger.info(
      `[syncProductStock] 재고 동기화 완료: ${product.name} (${product.stock} → ${newStock})`,
    );
    logger.groupEnd();

    return {
      success: true,
      message: `재고 동기화 완료: ${newStock}개`,
      stock: newStock,
    };
  } catch (error) {
    logger.error("[syncProductStock] 재고 동기화 예외", error);
    logger.groupEnd();
    return {
      success: false,
      message: `재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    };
  }
}

/**
 * 모든 상품 재고 동기화 (smartstore_product_id가 있는 상품만)
 */
export async function syncAllStocks(): Promise<SyncStockResult> {
  logger.group("[syncAllStocks] 전체 재고 동기화 시작");

  const result: SyncStockResult = {
    success: true,
    message: "",
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // 1. Supabase에서 동기화 대상 상품 조회
    const supabase = getServiceRoleClient();
    const { data: products, error: findError } = await supabase
      .from("products")
      .select("id, name, smartstore_product_id")
      .not("smartstore_product_id", "is", null)
      .eq("deleted_at", null);

    if (findError) {
      logger.error("[syncAllStocks] 상품 조회 실패", findError);
      result.success = false;
      result.message = `상품 조회 실패: ${findError.message}`;
      logger.groupEnd();
      return result;
    }

    if (!products || products.length === 0) {
      logger.info("[syncAllStocks] 동기화 대상 상품이 없습니다");
      result.message = "동기화 대상 상품이 없습니다";
      logger.groupEnd();
      return result;
    }

    logger.info(
      `[syncAllStocks] 동기화 대상 상품: ${products.length}개`,
    );

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
    logger.info(`[syncAllStocks] ${result.message}`);
    logger.groupEnd();

    return result;
  } catch (error) {
    logger.error("[syncAllStocks] 전체 재고 동기화 예외", error);
    result.success = false;
    result.message = `재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
    logger.groupEnd();
    return result;
  }
}




