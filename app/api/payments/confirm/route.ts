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

interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  console.group("[POST /api/payments/confirm] 결제 승인 처리");
  
  try {
    // 인증 확인
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      console.log("인증 실패");
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body: PaymentConfirmRequest = await request.json();
    console.log("결제 승인 요청 데이터:", body);

    const { paymentKey, orderId, amount } = body;

    // 입력값 검증
    if (!paymentKey || !orderId || !amount) {
      console.log("필수 입력값 누락");
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "필수 입력값이 누락되었습니다." },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      console.log("잘못된 결제 금액");
      console.groupEnd();
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
      console.log("사용자 없음");
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 주문 확인
    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, total_amount, status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (!order) {
      console.log("주문 없음");
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 금액 확인
    if (order.total_amount !== amount) {
      console.log("금액 불일치");
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 금액이 주문 금액과 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // TossPayments 시크릿 키 확인
    const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    if (!secretKey) {
      console.error("TossPayments 시크릿 키가 설정되지 않았습니다.");
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 서비스 설정 오류입니다." },
        { status: 500 }
      );
    }

    // TossPayments 결제 승인 API 호출
    console.log("TossPayments 결제 승인 API 호출");
    
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
      console.log(`[테스트 모드] TossPayments-Test-Code: ${testCode}`);
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
      console.error("TossPayments 결제 승인 실패:", errorData);
      
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

      console.groupEnd();
      return NextResponse.json(
        { success: false, message: errorData.message || "결제 승인에 실패했습니다." },
        { status: 400 }
      );
    }

    const tossPaymentData = await tossResponse.json();
    console.log("TossPayments 결제 승인 성공:", tossPaymentData);

    // 결제 정보 업데이트
    const { data: payment } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "ready")
      .single();

    if (!payment) {
      console.log("결제 정보 없음");
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 결제 정보 업데이트
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        payment_key: paymentKey,
        toss_payment_id: tossPaymentData.paymentKey || tossPaymentData.id,
        method: tossPaymentData.method || "card",
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
      console.error("결제 정보 업데이트 에러:", updateError);
      console.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 정보 업데이트에 실패했습니다." },
        { status: 500 }
      );
    }

    // 주문 상태 업데이트
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId);

    if (orderUpdateError) {
      console.error("주문 상태 업데이트 에러:", orderUpdateError);
      // 결제는 성공했으므로 경고만 로그
    }

    // 주문번호 조회
    const { data: orderData } = await supabase
      .from("orders")
      .select("order_number")
      .eq("id", orderId)
      .single();

    console.log("결제 승인 처리 완료");
    console.groupEnd();

    return NextResponse.json({
      success: true,
      message: "결제가 완료되었습니다.",
      paymentId: payment.id,
      orderId,
      orderNumber: orderData?.order_number || null,
    });
  } catch (error) {
    console.error("결제 승인 처리 에러:", error);
    console.groupEnd();
    return NextResponse.json(
      { success: false, message: "결제 승인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

