/**
 * @file app/api/admin/orders/export/route.ts
 * @description 주문 데이터 엑셀 다운로드 API 라우트
 */

import { NextRequest, NextResponse } from "next/server";
import { exportOrdersToExcel } from "@/actions/admin";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const fulfillmentStatus = searchParams.get("fulfillmentStatus") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const result = await exportOrdersToExcel(
      paymentStatus,
      fulfillmentStatus,
      startDate,
      endDate,
    );

    if (!result.success || !result.buffer) {
      logger.error("[GET /api/admin/orders/export] 엑셀 다운로드 실패", { message: result.message });
      return NextResponse.json(
        { error: result.message },
        { status: 400 },
      );
    }

    // 파일명 생성
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `주문내역_${dateStr}.xlsx`;

    // Buffer를 Uint8Array로 변환하여 NextResponse에 전달
    const buffer = new Uint8Array(result.buffer);
    
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    logger.error("[GET /api/admin/orders/export] 예외 발생", error);
    return NextResponse.json(
      { error: "엑셀 다운로드 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}




