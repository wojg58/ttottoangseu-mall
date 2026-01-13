/**
 * @file app/api/products/route.ts
 * @description 상품 목록 조회 API (무한 스크롤용)
 */

import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/actions/products";
import {
  rateLimitMiddleware,
  rateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  productQuerySchema,
  validateSchema,
} from "@/lib/validation";
import {
  sanitizeError,
  logError,
} from "@/lib/error-handler";

export async function GET(request: NextRequest) {
  // Rate Limiting 체크
  const rateLimitResult = await rateLimitMiddleware(
    request,
    RATE_LIMITS.PRODUCTS.limit,
    RATE_LIMITS.PRODUCTS.window,
  );

  if (!rateLimitResult?.success) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimitResult),
      },
    );
  }

  try {
    // 입력 검증
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      limit: searchParams.get("limit") || "12",
      skip: searchParams.get("skip") || "0",
    };

    const validationResult = validateSchema(productQuerySchema, queryParams);

    if (validationResult.success === false) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 },
      );
    }

    const { limit, skip } = validationResult.data;

    // 실제 페이지 계산 (skip을 고려)
    const actualPage = Math.floor(skip / limit) + 1;

    const result = await getProducts({}, actualPage, limit);

    return NextResponse.json({
      products: result.data,
      total: result.total,
      hasMore: result.page < result.totalPages,
    });
  } catch (error) {
    logError(error, { api: "/api/products", step: "get_products" });
    return NextResponse.json(
      { error: sanitizeError(error, "상품 조회에 실패했습니다.") },
      { status: 500 },
    );
  }
}

