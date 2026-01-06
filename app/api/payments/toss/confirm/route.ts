/**
 * @file app/api/payments/toss/confirm/route.ts
 * @description 토스페이먼츠 결제 승인 API
 * 
 * 주요 기능:
 * 1. successUrl로 돌아온 paymentKey, orderId, amount를 받아
 * 2. 토스 결제 승인(approve) API 호출
 * 3. 결제 성공 처리 (PAID 업데이트)
 * 
 * @dependencies
 * - @clerk/nextjs/server: 인증 확인
 * - @/lib/supabase/server: Supabase 클라이언트
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";

interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  requestedAt: string;
  approvedAt: string;
  card?: {
    company: string;
    number: string;
    installmentPlanMonths: number;
    isInterestFree: boolean;
    approveNo: string;
    cardType: string;
    ownerType: string;
    acquireStatus: string;
  };
  transfer?: {
    bankCode: string;
    settlementStatus: string;
  };
  virtualAccount?: {
    accountNumber: string;
    bankCode: string;
    customerName: string;
    dueDate: string;
    refundStatus: string;
    bankName?: string;
  };
  receipt?: {
    url: string;
  };
  currency: string;
  country: string;
}

export async function POST(request: NextRequest) {
  logger.group("[POST /api/payments/toss/confirm] 결제 승인 시작");

  try {
    // 1. 인증 확인
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      logger.error("인증되지 않은 사용자");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    logger.info("✅ 사용자 인증 완료:", clerkUserId);

    // 2. 요청 본문 파싱
    const body = await request.json();
    const { paymentKey, orderId, amount } = body;

    logger.info("결제 승인 요청:", {
      paymentKey: paymentKey ? paymentKey.substring(0, 10) + "..." : null,
      orderId,
      amount,
    });

    // 3. 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      logger.error("필수 파라미터 누락");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    const amountNumber = parseInt(amount, 10);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      logger.error("잘못된 금액 형식:", amount);
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "잘못된 결제 금액입니다." },
        { status: 400 }
      );
    }

    // 4. Supabase 서비스 롤 클라이언트 생성 (RLS 우회)
    const supabase = getServiceRoleClient();

    // 5. 사용자 ID 조회
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (!user) {
      logger.error("사용자를 찾을 수 없음");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 6. 주문 정보 조회 및 검증
    logger.info("주문 정보 조회 중...");
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, total_amount, status, order_number")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) {
      logger.error("주문 조회 실패:", orderError);
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "주문 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    logger.info("✅ 주문 정보 조회 완료:", {
      orderNumber: order.order_number,
      totalAmount: order.total_amount,
      status: order.status,
    });

    // 7. 결제 금액 검증
    if (order.total_amount !== amountNumber) {
      logger.error("결제 금액 불일치:", {
        orderAmount: order.total_amount,
        paymentAmount: amountNumber,
      });
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 금액이 일치하지 않습니다." },
        { status: 400 }
      );
    }

    logger.info("✅ 결제 금액 검증 완료");

    // 8. 이미 결제 완료된 주문인지 확인
    if (order.status === "paid") {
      logger.warn("이미 결제 완료된 주문");
      logger.groupEnd();
      return NextResponse.json(
        { success: true, message: "이미 결제가 완료된 주문입니다.", orderId: order.order_number },
        { status: 200 }
      );
    }

    // 9. 토스페이먼츠 승인 API 호출
    logger.info("토스페이먼츠 승인 API 호출 중...");
    const secretKey =
      process.env.TOSS_SECRET_KEY || process.env.TOSS_PAYMENTS_SECRET_KEY;

    if (!secretKey) {
      logger.error("토스페이먼츠 시크릿 키가 설정되지 않음");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 설정 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://api.tosspayments.com/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount: amountNumber,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      logger.error("토스페이먼츠 승인 실패:", errorData);
      logger.groupEnd();
      return NextResponse.json(
        {
          success: false,
          message: errorData.message || "결제 승인에 실패했습니다.",
        },
        { status: response.status }
      );
    }

    const paymentData: TossPaymentResponse = await response.json();
    logger.info("✅ 토스페이먼츠 승인 성공:", {
      paymentKey: paymentData.paymentKey,
      status: paymentData.status,
      method: paymentData.method,
      totalAmount: paymentData.totalAmount,
    });

    // 10. 결제 정보 데이터베이스 저장
    logger.info("결제 정보 데이터베이스 저장 중...");
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      payment_key: paymentData.paymentKey,
      payment_method: paymentData.method,
      amount: paymentData.totalAmount,
      status: paymentData.status,
      requested_at: paymentData.requestedAt,
      approved_at: paymentData.approvedAt,
      payment_data: paymentData, // 전체 응답 데이터 저장 (JSONB)
    });

    if (paymentError) {
      logger.error("결제 정보 저장 실패:", paymentError);
      // 결제는 성공했지만 DB 저장 실패 (수동 처리 필요)
      logger.groupEnd();
      return NextResponse.json(
        {
          success: true,
          message:
            "결제는 완료되었으나 정보 저장에 실패했습니다. 고객센터에 문의해주세요.",
          paymentKey: paymentData.paymentKey,
          orderId: order.order_number,
        },
        { status: 200 }
      );
    }

    logger.info("✅ 결제 정보 저장 완료");

    // 11. 주문 상태 업데이트 (PAID)
    logger.info("주문 상태 업데이트 중...");
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      logger.error("주문 상태 업데이트 실패:", updateError);
    } else {
      logger.info("✅ 주문 상태 업데이트 완료 (PAID)");
    }

    logger.info("🎉 결제 승인 프로세스 완료!");
    logger.groupEnd();

    return NextResponse.json({
      success: true,
      message: "결제가 완료되었습니다.",
      paymentKey: paymentData.paymentKey,
      orderId: order.order_number,
      method: paymentData.method,
      virtualAccount: paymentData.virtualAccount,
    });
  } catch (error) {
    logger.error("결제 승인 중 예외 발생:", error);
    logger.groupEnd();
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "결제 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

