/**
 * @file app/api/admin/orders/export/route.ts
 * @description 주문 데이터 엑셀 다운로드 API 라우트
 */

import { NextRequest, NextResponse } from "next/server";
import { exportOrdersToExcel } from "@/actions/admin";

export async function GET(request: NextRequest) {
  console.group("[GET /api/admin/orders/export] 엑셀 다운로드 요청");

  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const fulfillmentStatus = searchParams.get("fulfillmentStatus") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    console.log("필터 파라미터:", {
      paymentStatus,
      fulfillmentStatus,
      startDate,
      endDate,
    });

    const result = await exportOrdersToExcel(
      paymentStatus,
      fulfillmentStatus,
      startDate,
      endDate,
    );

    if (!result.success || !result.buffer) {
      console.error("엑셀 다운로드 실패:", result.message);
      console.groupEnd();
      return NextResponse.json(
        { error: result.message },
        { status: 400 },
      );
    }

    // 파일명 생성
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `주문내역_${dateStr}.xlsx`;

    console.log("엑셀 파일 다운로드 성공:", filename);
    console.groupEnd();

    return new NextResponse(result.buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("엑셀 다운로드 예외:", error);
    console.groupEnd();
    return NextResponse.json(
      { error: "엑셀 다운로드 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

