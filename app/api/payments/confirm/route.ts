/**
 * @file app/api/payments/confirm/route.ts
 * @description TossPayments 결제 승인 처리 API
 *
 * 주요 기능:
 * 1. TossPayments 결제 승인 처리
 * 2. 결제 정보 업데이트 (payments 테이블)
 * 3. 주문 상태 업데이트 (orders 테이블)
 *
 * 테스트 환경에서 에러 재현:
 * - 환경 변수 TOSS_PAYMENTS_TEST_CODE에 테스트 코드를 설정하면
 *   TossPayments-Test-Code 헤더가 자동으로 추가됩니다.
 * - test_ 로 시작하는 API 키를 사용할 때만 테스트 헤더가 적용됩니다.
 * - 예시: TOSS_PAYMENTS_TEST_CODE=INVALID_CARD_EXPIRATION
 *
 * @dependencies
 * - TossPayments API: 결제 승인 API 호출
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";

interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      logger.warn("[POST /api/payments/confirm] 인증 실패");
      return NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body: PaymentConfirmRequest = await request.json();
    const { paymentKey, orderId, amount } = body;

    // 입력값 검증
    if (!paymentKey || !orderId || !amount) {
      logger.warn("[POST /api/payments/confirm] 필수 입력값 누락");
      return NextResponse.json(
        { success: false, message: "필수 입력값이 누락되었습니다." },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      logger.warn("[POST /api/payments/confirm] 잘못된 결제 금액", { amount });
      return NextResponse.json(
        { success: false, message: "결제 금액이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // Supabase 서비스 롤 클라이언트 생성 (RLS 우회)
    const supabase = getServiceRoleClient();

    // 사용자 ID 조회
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (!user) {
      logger.warn("[POST /api/payments/confirm] 사용자 없음", { clerkUserId });
      return NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 주문 확인
    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, total_amount, payment_status, fulfillment_status, status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (!order) {
      logger.warn("[POST /api/payments/confirm] 주문 없음", { orderId });
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 금액 확인
    if (order.total_amount !== amount) {
      logger.warn("[POST /api/payments/confirm] 금액 불일치", { orderId, orderAmount: order.total_amount, requestAmount: amount });
      return NextResponse.json(
        { success: false, message: "결제 금액이 주문 금액과 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // TossPayments 시크릿 키 확인
    const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    if (!secretKey) {
      logger.error("[POST /api/payments/confirm] TossPayments 시크릿 키 미설정");
      return NextResponse.json(
        { success: false, message: "결제 서비스 설정 오류입니다." },
        { status: 500 }
      );
    }

    // TossPayments 결제 승인 API 호출
    // 테스트 환경에서 에러 재현을 위한 헤더 준비
    const headers: Record<string, string> = {
      "Authorization": `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    };

    // 테스트 코드 헤더 추가 (환경 변수에 설정된 경우)
    // test_ 로 시작하는 API 키를 사용할 때만 테스트 헤더가 적용됩니다.
    const testCode = process.env.TOSS_PAYMENTS_TEST_CODE;
    if (testCode && secretKey.startsWith("test_")) {
      headers["TossPayments-Test-Code"] = testCode;
      logger.debug(`[POST /api/payments/confirm] 테스트 모드: TossPayments-Test-Code: ${testCode}`);
    }
    
    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers,
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    if (!tossResponse.ok) {
      const errorData = await tossResponse.json();
      logger.error("[POST /api/payments/confirm] TossPayments 결제 승인 실패", errorData);
      
      // 결제 실패 정보 저장
      const { data: payment } = await supabase
        .from("payments")
        .select("id")
        .eq("order_id", orderId)
        .eq("status", "ready")
        .single();

      if (payment) {
        await supabase
          .from("payments")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            failure_code: errorData.code || "UNKNOWN",
            failure_message: errorData.message || "결제 승인에 실패했습니다.",
          })
          .eq("id", payment.id);
      }

      return NextResponse.json(
        { success: false, message: errorData.message || "결제 승인에 실패했습니다." },
        { status: 400 }
      );
    }

    const tossPaymentData = await tossResponse.json();

    // 결제 정보 업데이트
    const { data: payment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "ready")
      .single();

    if (!payment) {
      logger.warn("[POST /api/payments/confirm] 결제 정보 없음", { orderId });
      return NextResponse.json(
        { success: false, message: "결제 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 결제 정보 업데이트
    const { normalizePaymentMethod } = await import("@/lib/utils/payment-method");
    const normalizedMethod = normalizePaymentMethod(tossPaymentData.method || "card");
    
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        payment_key: paymentKey,
        toss_payment_id: tossPaymentData.paymentKey || tossPaymentData.id,
        method: normalizedMethod, // 한글/영어 → 영어 소문자 변환 (카드/CARD → card)
        status: "done",
        approved_at: new Date().toISOString(),
        receipt_url: tossPaymentData.receipt?.url || null,
        card_company: tossPaymentData.card?.company || null,
        card_number: tossPaymentData.card?.number || null,
        installment_plan_months: tossPaymentData.card?.installmentPlanMonths || null,
        metadata: tossPaymentData,
      })
      .eq("id", payment.id);

    if (updateError) {
      logger.error("[POST /api/payments/confirm] 결제 정보 업데이트 실패", updateError);
      return NextResponse.json(
        { success: false, message: "결제 정보 업데이트에 실패했습니다." },
        { status: 500 }
      );
    }

    // 재고 차감 (결제 성공 시점에만 수행)
    const { deductOrderStock } = await import("@/actions/orders");
    const stockResult = await deductOrderStock(orderId, supabase);
    
    if (!stockResult.success) {
      logger.warn("[POST /api/payments/confirm] 재고 차감 실패 (결제는 성공)", { message: stockResult.message });
    }

    // 주문 상태 업데이트
    // 결제 승인 시간을 paid_at에 저장 (tossPaymentData.approvedAt 또는 payments 테이블의 approved_at 사용)
    // tossPaymentData에 approvedAt이 없으면 payments 테이블에서 조회
    let paidAt: string;
    if ((tossPaymentData as any).approvedAt) {
      paidAt = (tossPaymentData as any).approvedAt;
    } else {
      // payments 테이블에서 approved_at 조회
      const { data: paymentData } = await supabase
        .from("payments")
        .select("approved_at")
        .eq("id", payment.id)
        .single();
      paidAt = paymentData?.approved_at || new Date().toISOString();
    }
    
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({ 
        payment_status: "PAID",
        fulfillment_status: "UNFULFILLED",
        status: "PAID", // 하위 호환성
        paid_at: paidAt, // 결제 승인 시간 저장
      })
      .eq("id", orderId);

    if (orderUpdateError) {
      logger.warn("[POST /api/payments/confirm] 주문 상태 업데이트 실패 (결제는 성공)", orderUpdateError);
    }

    // 주문번호 및 주문 정보 조회
    const { data: orderData } = await supabase
      .from("orders")
      .select("order_number, total_amount, created_at")
      .eq("id", orderId)
      .single();

    // 관리자 알림 발송 (이메일/알림톡)
    try {
      const { notifyAdminOnOrderPaid } = await import("@/lib/notifications/notifyAdminOnOrderPaid");
      if (orderData) {
        const notificationResult = await notifyAdminOnOrderPaid({
          orderId: orderId,
          orderNo: orderData.order_number,
          amount: orderData.total_amount,
          createdAtUtc: orderData.created_at,
        });

        if (!notificationResult.success) {
          logger.warn("[POST /api/payments/confirm] 관리자 알림 발송 실패 (결제는 성공)", { errors: notificationResult.errors });
        }
      }
    } catch (e) {
      logger.warn("[POST /api/payments/confirm] 관리자 알림 발송 예외 (결제는 성공)", e);
    }

    return NextResponse.json({
      success: true,
      message: "결제가 완료되었습니다.",
      paymentId: payment.id,
      orderId,
      orderNumber: orderData?.order_number || null,
    });
  } catch (error) {
    logger.error("[POST /api/payments/confirm] 예외 발생", error);
    return NextResponse.json(
      { success: false, message: "결제 승인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

