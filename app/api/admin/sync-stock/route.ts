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
 * - GET/POST /api/admin/sync-stock: 전체 재고 동기화 (상품 + 옵션)
 * - GET/POST /api/admin/sync-stock?variantOnly=true: 옵션만 동기화
 * - GET/POST /api/admin/sync-stock?productOnly=true: 상품만 동기화
 */

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/actions/admin";
import {
  syncAllStocks,
  syncAllVariantStocks,
  syncProductStock,
} from "@/actions/sync-stock";
import { getSmartStoreApiClient } from "@/lib/utils/smartstore-api";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

/**
 * 재고 동기화 실행 공통 로직
 */
async function executeSync(request: NextRequest) {
  const startTime = Date.now();
  const method = request.method;
  logger.group(`[${method} /api/admin/sync-stock] 재고 동기화 시작`);

  try {
    // 1. 관리자 권한 확인
    const adminCheck = await isAdmin();
    if (!adminCheck) {
      logger.error(`[${method} /api/admin/sync-stock] 관리자 권한 없음`);
      logger.groupEnd();
      return NextResponse.json(
        {
          success: false,
          message: "관리자 권한이 필요합니다.",
        },
        { status: 403 },
      );
    }

    logger.info(`[${method} /api/admin/sync-stock] 관리자 권한 확인 완료`);

    const searchParams = request.nextUrl.searchParams;
    const variantOnly = searchParams.get("variantOnly") === "true";
    const productOnly = searchParams.get("productOnly") === "true";
    const testProductId = searchParams.get("testProductId"); // 검증용: 특정 상품 ID로 테스트
    const sampleOnly = searchParams.get("sampleOnly") === "true";
    const sampleSize = Number(searchParams.get("sampleSize") || "3");

    // 검증 모드: 특정 상품 ID로 getProduct vs getChannelProduct 비교
    if (testProductId) {
      logger.info(`[${method} /api/admin/sync-stock] 검증 모드: ${testProductId}`);
      const apiClient = getSmartStoreApiClient();
      
      // 1. getProduct 호출 (원상품 번호용)
      logger.info("[검증] getProduct 호출 시작", { productId: testProductId });
      const productResult = await apiClient.getProduct(testProductId);
      
      // 2. getChannelProduct 호출 (채널상품 번호용)
      logger.info("[검증] getChannelProduct 호출 시작", { channelProductNo: testProductId });
      const channelProductResult = await apiClient.getChannelProduct(testProductId);
      
      // 3. 결과 비교
      const comparison = {
        testProductId,
        getProduct: {
          success: productResult !== null,
          result: productResult ? {
            productId: productResult.productId,
            name: productResult.name,
            stockQuantity: productResult.stockQuantity,
            saleStatus: productResult.saleStatus,
          } : null,
        },
        getChannelProduct: {
          success: channelProductResult !== null,
          result: channelProductResult ? {
            channelProductNo: channelProductResult.channelProductNo,
            originProductNo: channelProductResult.originProductNo,
            name: channelProductResult.name,
            stockQuantity: channelProductResult.stockQuantity,
            statusType: channelProductResult.statusType,
            channelProductDisplayStatusType: channelProductResult.channelProductDisplayStatusType,
          } : null,
        },
        recommendation: productResult ? "getProduct 사용 가능 (원상품 번호)" : 
                      channelProductResult ? "getChannelProduct 사용 가능 (채널상품 번호)" : 
                      "둘 다 실패 - 상품 ID 확인 필요",
      };
      
      logger.info("[검증] API 비교 결과", comparison);
      logger.groupEnd();
      
      return NextResponse.json({
        success: true,
        message: "검증 완료",
        comparison,
      });
    }

    // 샘플 모드: 첫 1~3개 상품만 SmartStore 조회 테스트
    if (sampleOnly) {
      const supabase = getServiceRoleClient();
      const apiClient = getSmartStoreApiClient();
      const limitedSize = Number.isFinite(sampleSize)
        ? Math.min(Math.max(sampleSize, 1), 3)
        : 3;

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, smartstore_product_id")
        .not("smartstore_product_id", "is", null)
        .is("deleted_at", null)
        .limit(limitedSize);

      if (productsError || !products) {
        logger.error(`[${method} /api/admin/sync-stock] 샘플 모드 조회 실패`, {
          productsError,
        });
        logger.groupEnd();
        return NextResponse.json(
          {
            success: false,
            message: "샘플 모드 상품 조회 실패",
            error: productsError?.message,
          },
          { status: 500 },
        );
      }

      const samples = [];
      for (const product of products) {
        const smartstoreId = String(product.smartstore_product_id).trim();
        try {
          const channelProduct = await apiClient.getChannelProduct(smartstoreId);
          samples.push({
            productId: product.id,
            name: product.name,
            smartstoreProductId: smartstoreId,
            success: !!channelProduct,
            channelProductNo: channelProduct?.channelProductNo,
            originProductNo: channelProduct?.originProductNo,
            stockQuantity: channelProduct?.stockQuantity,
            statusType: channelProduct?.statusType,
            channelProductDisplayStatusType:
              channelProduct?.channelProductDisplayStatusType,
          });
        } catch (error) {
          samples.push({
            productId: product.id,
            name: product.name,
            smartstoreProductId: smartstoreId,
            success: false,
            error: error instanceof Error ? error.message : "알 수 없는 오류",
          });
        }
      }

      logger.info(`[${method} /api/admin/sync-stock] 샘플 모드 완료`, {
        count: samples.length,
        samples,
      });
      logger.groupEnd();
      return NextResponse.json({
        success: true,
        message: "샘플 모드 완료",
        samples,
      });
    }

    const results: {
      productSync?: Awaited<ReturnType<typeof syncAllStocks>>;
      variantSync?: Awaited<ReturnType<typeof syncAllVariantStocks>>;
    } = {};

    // 2. 상품 재고 동기화
    if (!variantOnly) {
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
    if (!productOnly) {
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
