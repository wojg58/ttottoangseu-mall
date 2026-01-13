/**
 * @file app/api/payments/route.ts
 * @description TossPayments 결제 요청 API
 *
 * 주요 기능:
 * 1. 결제 요청 생성 (TossPayments API 호출)
 * 2. 결제 정보를 payments 테이블에 저장
 * 3. 결제 키 반환
 *
 * @dependencies
 * - @tosspayments/payment-widget-sdk: TossPayments SDK (서버 사이드)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  rateLimitMiddleware,
  rateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  paymentRequestSchema,
  validateSchema,
} from "@/lib/validation";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {

  // Rate Limiting 체크
  const rateLimitResult = await rateLimitMiddleware(
    request,
    RATE_LIMITS.PAYMENT.limit,
    RATE_LIMITS.PAYMENT.window,
  );

  if (!rateLimitResult?.success) {
    logger.warn("[POST /api/payments] RateLimit 초과");
    return NextResponse.json(
      { success: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimitResult),
      },
    );
  }
  
  try {
    // 인증 확인
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      logger.warn("[POST /api/payments] 인증 실패");
      return NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // 입력 검증
    const body = await request.json();
    const validationResult = validateSchema(paymentRequestSchema, body);

    if (validationResult.success === false) {
      logger.warn("[POST /api/payments] 검증 실패", { error: validationResult.error });
      return NextResponse.json(
        { success: false, message: validationResult.error },
        { status: 400 }
      );
    }

    const { orderId, orderNumber, amount, customerName, customerEmail } = validationResult.data;

    // Supabase 서비스 롤 클라이언트 생성 (RLS 우회)
    const supabase = getServiceRoleClient();

    // 사용자 ID 조회
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (!user) {
      logger.warn("[POST /api/payments] 사용자 없음", { clerkUserId });
      return NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 주문 확인
    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, total_amount, payment_status, status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (!order) {
      logger.warn("[POST /api/payments] 주문 없음", { orderId });
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const paymentStatus = order.payment_status || order.status;
    if (paymentStatus !== "PENDING") {
      logger.warn("[POST /api/payments] 이미 처리된 주문", { orderId, paymentStatus });
      return NextResponse.json(
        { success: false, message: "이미 처리된 주문입니다." },
        { status: 400 }
      );
    }

    // 금액 확인
    if (order.total_amount !== amount) {
      logger.warn("[POST /api/payments] 금액 불일치", { orderId, orderAmount: order.total_amount, requestAmount: amount });
      return NextResponse.json(
        { success: false, message: "결제 금액이 주문 금액과 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // TossPayments 시크릿 키 확인
    const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    if (!secretKey) {
      logger.error("[POST /api/payments] TossPayments 시크릿 키 미설정");
      return NextResponse.json(
        { success: false, message: "결제 서비스 설정 오류입니다." },
        { status: 500 }
      );
    }

    // TossPayments 결제 요청 생성
    // 참고: 실제 TossPayments API는 클라이언트에서 위젯을 통해 호출되므로,
    // 여기서는 결제 정보를 DB에 저장하고 결제 ID를 생성합니다.
    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 결제 정보 저장
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: orderId,
        toss_payment_id: paymentId,
        method: "card", // 기본값, 실제로는 위젯에서 선택
        status: "ready",
        amount: amount,
        requested_at: new Date().toISOString(),
        metadata: {
          orderNumber,
          customerName,
          customerEmail,
        },
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      logger.error("[POST /api/payments] 결제 정보 저장 실패", paymentError);
      return NextResponse.json(
        { success: false, message: "결제 정보 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId,
      orderId,
      orderNumber,
      amount,
    });
  } catch (error) {
    logger.error("[POST /api/payments] 예외 발생", error);
    return NextResponse.json(
      { success: false, message: "결제 요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

