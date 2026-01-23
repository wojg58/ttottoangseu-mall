/**
 * @file actions/admin-sync-stock.ts
 * @description 관리자 전용 스마트스토어 재고 동기화 Server Action
 *
 * 주요 기능:
 * 1. 관리자 권한 확인
 * 2. syncAllStocks() → syncAllVariantStocks() 순차 실행
 * 3. 요약 로그 출력
 *
 * @dependencies
 * - actions/sync-stock: 재고 동기화 로직
 * - actions/admin: 관리자 권한 확인
 */

"use server";

import { isAdmin } from "@/actions/admin";
import { syncAllStocks, syncAllVariantStocks } from "@/actions/sync-stock";
import { logger } from "@/lib/logger";

export interface AdminSyncStockResult {
  success: boolean;
  message: string;
  syncedProducts: number;
  syncedVariants: number;
}

/**
 * 관리자 전용 재고 동기화 (서버 전용 실행)
 */
export async function syncAdminStock(): Promise<AdminSyncStockResult> {
  logger.group("[syncAdminStock] 재고 동기화 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    logger.warn("[syncAdminStock] ❌ 관리자 권한 없음 - 동기화 중단");
    logger.groupEnd();
    return {
      success: false,
      message: "관리자 권한이 필요합니다.",
      syncedProducts: 0,
      syncedVariants: 0,
    };
  }

  logger.info("[syncAdminStock] ✅ 관리자 권한 확인됨 - 동기화 진행");

  const productSync = await syncAllStocks();
  logger.info("[syncAdminStock] 상품 재고 동기화 완료", {
    success: productSync.success,
    syncedCount: productSync.syncedCount,
    failedCount: productSync.failedCount,
    skippedCount: productSync.skippedCount || 0,
  });

  const variantSync = await syncAllVariantStocks();
  logger.info("[syncAdminStock] 옵션 재고 동기화 완료", {
    success: variantSync.success,
    syncedCount: variantSync.syncedCount,
    failedCount: variantSync.failedCount,
    skippedCount: variantSync.skippedCount || 0,
  });

  const success = productSync.success && variantSync.success;
  const syncedProducts = productSync.syncedCount || 0;
  const syncedVariants = variantSync.syncedCount || 0;

  logger.info("[syncAdminStock] 전체 동기화 완료", {
    success,
    syncedProducts,
    syncedVariants,
  });
  logger.groupEnd();

  return {
    success,
    message: success
      ? "재고 동기화 완료"
      : "재고 동기화 중 일부 실패가 발생했습니다.",
    syncedProducts,
    syncedVariants,
  };
}
