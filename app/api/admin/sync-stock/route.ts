/**
 * @file app/api/admin/sync-stock/route.ts
 * @description 관리자 전용 재고 동기화 테스트 엔드포인트
 *
 * 주요 기능:
 * 1. 관리자 권한 확인 (Clerk role 체크)
 * 2. syncAllStocks(), syncAllVariantStocks() 강제 실행
 * 3. 상세 로깅 및 성능 측정
 *
 * 사용 방법:
 * - POST /api/admin/sync-stock: 전체 재고 동기화 (상품 + 옵션)
 * - POST /api/admin/sync-stock?variantOnly=true: 옵션만 동기화
 * - POST /api/admin/sync-stock?productOnly=true: 상품만 동기화
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/actions/admin";
import {
  syncAllStocks,
  syncAllVariantStocks,
} from "@/actions/sync-stock";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.group("[POST /api/admin/sync-stock] 재고 동기화 시작");

  try {
    // 1. 관리자 권한 확인
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      logger.error("[POST /api/admin/sync-stock] 관리자 권한 없음");
      logger.groupEnd();
      return NextResponse.json(
        {
          success: false,
          message: "관리자 권한이 필요합니다.",
        },
        { status: 403 },
      );
    }

    logger.info("[POST /api/admin/sync-stock] 관리자 권한 확인 완료");

    const searchParams = request.nextUrl.searchParams;
    const variantOnly = searchParams.get("variantOnly") === "true";
    const productOnly = searchParams.get("productOnly") === "true";

    const results: {
      productSync?: Awaited<ReturnType<typeof syncAllStocks>>;
      variantSync?: Awaited<ReturnType<typeof syncAllVariantStocks>>;
    } = {};

    // 2. 상품 재고 동기화
    if (!variantOnly) {
      logger.info("[POST /api/admin/sync-stock] 상품 재고 동기화 시작");
      const productStartTime = Date.now();
      results.productSync = await syncAllStocks();
      const productElapsed = Date.now() - productStartTime;

      logger.info("[POST /api/admin/sync-stock] 상품 재고 동기화 완료", {
        success: results.productSync.success,
        syncedCount: results.productSync.syncedCount,
        failedCount: results.productSync.failedCount,
        elapsedMs: productElapsed,
        errors: results.productSync.errors.slice(0, 5), // 최대 5개만
      });
    }

    // 3. 옵션 재고 동기화
    if (!productOnly) {
      logger.info("[POST /api/admin/sync-stock] 옵션 재고 동기화 시작");
      const variantStartTime = Date.now();
      results.variantSync = await syncAllVariantStocks();
      const variantElapsed = Date.now() - variantStartTime;

      logger.info("[POST /api/admin/sync-stock] 옵션 재고 동기화 완료", {
        success: results.variantSync.success,
        syncedCount: results.variantSync.syncedCount,
        failedCount: results.variantSync.failedCount,
        elapsedMs: variantElapsed,
        errors: results.variantSync.errors.slice(0, 5), // 최대 5개만
      });
    }

    const totalElapsed = Date.now() - startTime;
    const totalSynced =
      (results.productSync?.syncedCount || 0) +
      (results.variantSync?.syncedCount || 0);
    const totalFailed =
      (results.productSync?.failedCount || 0) +
      (results.variantSync?.failedCount || 0);

    logger.info("[POST /api/admin/sync-stock] 전체 동기화 완료", {
      totalElapsedMs: totalElapsed,
      totalSynced,
      totalFailed,
    });
    logger.groupEnd();

    return NextResponse.json(
      {
        success: true,
        message: "재고 동기화 완료",
        results,
        summary: {
          totalSynced,
          totalFailed,
          elapsedMs: totalElapsed,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const totalElapsed = Date.now() - startTime;
    logger.error("[POST /api/admin/sync-stock] 예외 발생", error);
    logger.groupEnd();

    return NextResponse.json(
      {
        success: false,
        message: `재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        elapsedMs: totalElapsed,
      },
      { status: 500 },
    );
  }
}
