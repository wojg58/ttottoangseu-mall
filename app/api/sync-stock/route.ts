/**
 * @file app/api/sync-stock/route.ts
 * @description 재고 동기화 API 엔드포인트
 *
 * 주요 기능:
 * 1. 네이버 스마트스토어에서 재고 조회
 * 2. Supabase에 재고 업데이트
 *
 * 사용 방법:
 * - GET /api/sync-stock: 모든 상품 재고 동기화
 * - GET /api/sync-stock?productId={smartstore_product_id}: 단일 상품 재고 동기화
 *
 * 주기적 실행:
 * - 로컬호스트에서 cron job 또는 스케줄러로 주기적으로 호출
 * - 예: 5분마다 실행
 */

import { NextRequest, NextResponse } from "next/server";
import {
  syncAllStocks,
  syncProductStock,
  syncVariantStocks,
  syncAllVariantStocks,
} from "@/actions/sync-stock";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get("productId");
    const variantMode = searchParams.get("variant") === "true"; // 옵션 단위 동기화 여부

    // 옵션 단위 동기화
    if (variantMode) {
      if (productId) {
        logger.info(`[GET /api/sync-stock] 단일 상품 옵션 재고 동기화: ${productId}`);
        const result = await syncVariantStocks(productId);

        return NextResponse.json(result, {
          status: result.success ? 200 : 500,
        });
      }

      // 전체 상품 옵션 재고 동기화
      logger.info("[GET /api/sync-stock] 전체 상품 옵션 재고 동기화 시작");
      const result = await syncAllVariantStocks();

      return NextResponse.json(result, {
        status: result.success ? 200 : 500,
      });
    }

    // 기존 상품 단위 동기화 (하위 호환성)
    if (productId) {
      logger.info(`[GET /api/sync-stock] 단일 상품 재고 동기화: ${productId}`);
      const result = await syncProductStock(productId);

      return NextResponse.json(result, {
        status: result.success ? 200 : 500,
      });
    }

    // 전체 상품 동기화
    logger.info("[GET /api/sync-stock] 전체 상품 재고 동기화 시작");
    const result = await syncAllStocks();

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    logger.error("[GET /api/sync-stock] 예외 발생", error);
    return NextResponse.json(
      {
        success: false,
        message: `재고 동기화 중 오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      },
      { status: 500 },
    );
  }
}




