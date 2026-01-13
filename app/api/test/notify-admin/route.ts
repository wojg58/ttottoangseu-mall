/**
 * @file app/api/test/notify-admin/route.ts
 * @description 관리자 알림 테스트 엔드포인트
 *
 * 실결제 없이 관리자 알림톡/이메일 발송을 테스트할 수 있는 엔드포인트입니다.
 *
 * 사용 방법:
 * ```bash
 * curl -X POST http://localhost:3000/api/test/notify-admin \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "orderNo": "ORD-2026-001",
 *     "amount": 50000,
 *     "orderDateUtc": "2026-01-12T01:55:27.000Z"
 *   }'
 * ```
 *
 * @dependencies
 * - @/lib/notifications/formatTime: KST 변환
 * - @/lib/notifications/sendAdminAlimtalkSolapi: 알림톡 발송
 * - @/lib/notifications/sendAdminEmail: 이메일 발송
 */

import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

interface TestNotifyRequest {
  orderNo: string;
  amount: number;
  orderDateUtc: string; // ISO string (UTC)
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "테스트 엔드포인트가 정상 작동 중입니다.",
    endpoint: "/api/test/notify-admin",
    method: "POST",
  });
}

export async function POST(request: NextRequest) {
  logger.group("[POST /api/test/notify-admin] 관리자 알림 테스트");

  try {
    const body: TestNotifyRequest = await request.json();

    // 필수 필드 검증
    if (!body.orderNo || !body.amount || !body.orderDateUtc) {
      logger.error("필수 필드 누락:", body);
      logger.groupEnd();
      return NextResponse.json(
        {
          success: false,
          message: "필수 필드가 누락되었습니다. (orderNo, amount, orderDateUtc 필요)",
        },
        { status: 400 }
      );
    }

    logger.info("테스트 알림 요청:", {
      orderNo: body.orderNo,
      amount: body.amount,
      orderDateUtc: body.orderDateUtc,
    });

    // 테스트용: DB 조회 없이 직접 알림 함수 호출
    const { formatTimeForNotification } = await import("@/lib/notifications/formatTime");
    const { sendAdminAlimtalkSolapi } = await import("@/lib/notifications/sendAdminAlimtalkSolapi");
    const { sendAdminEmail } = await import("@/lib/notifications/sendAdminEmail");

    // UTC → KST 변환
    const orderDateKst = formatTimeForNotification(body.orderDateUtc);
    logger.info("[테스트] 주문일시 (KST):", orderDateKst);

    // 알림톡/이메일 병렬 발송 (Promise.allSettled 사용)
    logger.info("[ALIMTALK_TRACE] /api/test/notify-admin -> sendAdminAlimtalkSolapi called");
    const results = await Promise.allSettled([
      sendAdminAlimtalkSolapi(body.orderNo, body.amount, orderDateKst),
      sendAdminEmail(body.orderNo, body.amount, orderDateKst),
    ]);

    const alimtalkResult = results[0];
    const emailResult = results[1];

    // 결과 처리
    let alimtalkSent = false;
    let emailSent = false;
    const errors: string[] = [];

    if (alimtalkResult.status === "fulfilled") {
      if (alimtalkResult.value.success) {
        alimtalkSent = true;
        logger.info("[테스트] ✅ 알림톡 발송 완료");
      } else {
        logger.error("[테스트] ❌ 알림톡 발송 실패:", alimtalkResult.value.error);
        errors.push(`알림톡: ${alimtalkResult.value.error || "알 수 없는 오류"}`);
      }
    } else {
      logger.error("[테스트] ❌ 알림톡 발송 예외:", alimtalkResult.reason);
      errors.push(`알림톡: ${alimtalkResult.reason?.message || "알 수 없는 오류"}`);
    }

    if (emailResult.status === "fulfilled") {
      if (emailResult.value.success) {
        emailSent = true;
        logger.info("[테스트] ✅ 이메일 발송 완료");
      } else {
        logger.error("[테스트] ❌ 이메일 발송 실패:", emailResult.value.error);
        errors.push(`이메일: ${emailResult.value.error || "알 수 없는 오류"}`);
      }
    } else {
      logger.error("[테스트] ❌ 이메일 발송 예외:", emailResult.reason);
      errors.push(`이메일: ${emailResult.reason?.message || "알 수 없는 오류"}`);
    }

    const result = {
      success: alimtalkSent || emailSent,
      alimtalkSent,
      emailSent,
      errors: errors.length > 0 ? errors : undefined,
    };

    logger.info("알림 발송 결과:", result);
    logger.groupEnd();

    return NextResponse.json({
      success: result.success,
      message: "테스트 알림 발송 완료",
      result: {
        alimtalkSent: result.alimtalkSent,
        emailSent: result.emailSent,
        errors: result.errors,
      },
    });
  } catch (error) {
    logger.error("테스트 알림 발송 중 예외:", error);
    logger.groupEnd();
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
