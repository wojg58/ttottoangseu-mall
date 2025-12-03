/**
 * @file app/api/products/route.ts
 * @description 상품 목록 조회 API (무한 스크롤용)
 */

import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/actions/products";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "5", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    // 실제 페이지 계산 (skip을 고려)
    const actualPage = Math.floor(skip / limit) + 1;

    const result = await getProducts({}, actualPage, limit);

    return NextResponse.json({
      products: result.data,
      total: result.total,
      hasMore: result.page < result.totalPages,
    });
  } catch (error) {
    console.error("[API] 상품 조회 에러:", error);
    return NextResponse.json(
      { error: "상품 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}

