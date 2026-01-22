/**
 * @file app/api/admin/sync-stock/route.ts
 * @description 관리자 전용 재고 동기화 테스트 엔드포인트
 *
 * 주요 기능:
 * 1. 관리자 권한 확인 (헤더 기반 시크릿)
 * 2. syncAllStocks(), syncAllVariantStocks() 강제 실행
 * 3. 상세 로깅 및 성능 측정
 *
 * 사용 방법:
 * - GET/POST /api/admin/sync-stock: 전체 재고 동기화 (상품 + 옵션)
 * - GET/POST /api/admin/sync-stock?variantOnly=true: 옵션만 동기화
 * - GET/POST /api/admin/sync-stock?productOnly=true: 상품만 동기화
 *
 * 인증:
 * - header: x-admin-secret
 * - env: ADMIN_SYNC_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllStocks, syncAllVariantStocks } from "@/actions/sync-stock";
import { logger } from "@/lib/logger";

function maskSecret(value: string) {
  return {
    length: value.length,
    prefix: value.slice(0, 4),
    suffix: value.slice(-4),
  };
}

function validateAdminSecret(request: NextRequest) {
  const secret = process.env.ADMIN_SYNC_SECRET;
  const header = request.headers.get("x-admin-secret") || "";

  if (!secret) {
    logger.error("[/api/admin/sync-stock] ADMIN_SYNC_SECRET 미설정");
    return {
      ok: false,
      status: 500,
      message: "서버 설정 오류: ADMIN_SYNC_SECRET이 필요합니다.",
    };
  }

  if (header !== secret) {
    logger.warn("[/api/admin/sync-stock] 관리자 시크릿 불일치", {
      provided: header ? maskSecret(header) : null,
    });
    return {
      ok: false,
      status: 401,
      message: "인증 실패: x-admin-secret이 올바르지 않습니다.",
    };
  }

  return { ok: true as const };
}

/**
 * 재고 동기화 실행 공통 로직
 */
async function executeSync(request: NextRequest) {
  const startTime = Date.now();
  const method = request.method;
  logger.group(`[${method} /api/admin/sync-stock] 재고 동기화 시작`);

  try {
    const auth = validateAdminSecret(request);
    if (!auth.ok) {
      logger.error(`[${method} /api/admin/sync-stock] 관리자 인증 실패`);
      logger.groupEnd();
      return NextResponse.json(
        {
          success: false,
          message: auth.message,
        },
        { status: auth.status },
      );
    }

    logger.info(`[${method} /api/admin/sync-stock] 관리자 인증 완료`);

    const searchParams = request.nextUrl.searchParams;
    const variantOnly = searchParams.get("variantOnly") === "true";
    const productOnly = searchParams.get("productOnly") === "true";
    let runProductSync = !variantOnly;
    let runVariantSync = variantOnly;

    if (productOnly) {
      runProductSync = true;
      runVariantSync = false;
    }

    const results: {
      productSync?: Awaited<ReturnType<typeof syncAllStocks>>;
      variantSync?: Awaited<ReturnType<typeof syncAllVariantStocks>>;
    } = {};

    // 2. 상품 재고 동기화
    if (runProductSync) {
      logger.info(`[${method} /api/admin/sync-stock] 상품 재고 동기화 시작`);
      const productStartTime = Date.now();
      results.productSync = await syncAllStocks();
      const productElapsed = Date.now() - productStartTime;

      logger.info(`[${method} /api/admin/sync-stock] 상품 재고 동기화 완료`, {
        success: results.productSync.success,
        syncedCount: results.productSync.syncedCount,
        failedCount: results.productSync.failedCount,
        skippedCount: results.productSync.skippedCount || 0,
        elapsedMs: productElapsed,
        errors: results.productSync.errors.slice(0, 5), // 최대 5개만
      });
    }

    // 3. 옵션 재고 동기화
    if (runVariantSync) {
      logger.info(`[${method} /api/admin/sync-stock] 옵션 재고 동기화 시작`);
      const variantStartTime = Date.now();
      results.variantSync = await syncAllVariantStocks();
      const variantElapsed = Date.now() - variantStartTime;

      logger.info(`[${method} /api/admin/sync-stock] 옵션 재고 동기화 완료`, {
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
    const totalSkipped = results.productSync?.skippedCount || 0;

    logger.info(`[${method} /api/admin/sync-stock] 전체 동기화 완료`, {
      totalElapsedMs: totalElapsed,
      totalSynced,
      totalFailed,
      totalSkipped,
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
          totalSkipped,
          elapsedMs: totalElapsed,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const totalElapsed = Date.now() - startTime;
    logger.error(`[${method} /api/admin/sync-stock] 예외 발생`, error);
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

export async function GET(request: NextRequest) {
  return executeSync(request);
}

export async function POST(request: NextRequest) {
  return executeSync(request);
}
