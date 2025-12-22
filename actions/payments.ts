/**
 * @file actions/payments.ts
 * @description 토스페이먼츠 결제 처리 Server Actions
 *
 * 주요 기능:
 * 1. 결제 승인 처리 (토스페이먼츠 API 호출)
 * 2. 결제 정보 데이터베이스 저장
 * 3. 주문 상태 업데이트
 *
 * @dependencies
 * - @clerk/nextjs/server: 인증 확인
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

interface ConfirmPaymentParams {
  paymentKey: string;
  orderId: string;
  amount: number;
}

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
  virtualAccount?: {
    accountNumber: string;
    bankCode: string;
    customerName: string;
    dueDate: string;
    refundStatus: string;
  };
  transfer?: {
    bankCode: string;
    settlementStatus: string;
  };
  receipt?: {
    url: string;
  };
  currency: string;
  country: string;
}

/**
 * 토스페이먼츠 결제 승인
 * 
 * 결제 인증이 완료된 후 최종 승인을 처리합니다.
 * 1. 토스페이먼츠 승인 API 호출
 * 2. 결제 정보 데이터베이스 저장
 * 3. 주문 상태를 '결제완료'로 업데이트
 */
export async function confirmPayment({
  paymentKey,
  orderId,
  amount,
}: ConfirmPaymentParams) {
  console.group("[confirmPayment] 결제 승인 시작");
  console.log("paymentKey:", paymentKey);
  console.log("orderId:", orderId);
  console.log("amount:", amount);
  console.groupEnd();

  try {
    // 1. 인증 확인
    const { userId } = await auth();
    if (!userId) {
      console.error("[confirmPayment] ❌ 인증되지 않은 사용자");
      return {
        success: false,
        message: "로그인이 필요합니다.",
      };
    }

    console.log("[confirmPayment] ✅ 사용자 인증 완료:", userId);

    // 2. Supabase 클라이언트 생성
    const supabase = await createClient();

    // 3. 주문 정보 조회 (검증용)
    console.log("[confirmPayment] 주문 정보 조회 중...");
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("clerk_user_id", userId)
      .single();

    if (orderError || !order) {
      console.error("[confirmPayment] ❌ 주문 조회 실패:", orderError);
      return {
        success: false,
        message: "주문 정보를 찾을 수 없습니다.",
      };
    }

    console.log("[confirmPayment] ✅ 주문 정보 조회 완료:", {
      orderNumber: order.order_number,
      totalAmount: order.total_amount,
    });

    // 4. 결제 금액 검증
    if (order.total_amount !== amount) {
      console.error("[confirmPayment] ❌ 결제 금액 불일치:", {
        orderAmount: order.total_amount,
        paymentAmount: amount,
      });
      return {
        success: false,
        message: "결제 금액이 일치하지 않습니다.",
      };
    }

    console.log("[confirmPayment] ✅ 결제 금액 검증 완료");

    // 5. 토스페이먼츠 승인 API 호출
    console.log("[confirmPayment] 토스페이먼츠 승인 API 호출 중...");
    const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;
    
    if (!secretKey) {
      console.error("[confirmPayment] ❌ 토스페이먼츠 시크릿 키가 설정되지 않았습니다.");
      return {
        success: false,
        message: "결제 설정 오류가 발생했습니다.",
      };
    }

    const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[confirmPayment] ❌ 토스페이먼츠 승인 실패:", errorData);
      return {
        success: false,
        message: errorData.message || "결제 승인에 실패했습니다.",
      };
    }

    const paymentData: TossPaymentResponse = await response.json();
    console.log("[confirmPayment] ✅ 토스페이먼츠 승인 성공:", {
      paymentKey: paymentData.paymentKey,
      status: paymentData.status,
      method: paymentData.method,
      totalAmount: paymentData.totalAmount,
    });

    // 6. 결제 정보 데이터베이스 저장
    console.log("[confirmPayment] 결제 정보 데이터베이스 저장 중...");
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
      console.error("[confirmPayment] ❌ 결제 정보 저장 실패:", paymentError);
      // 결제는 성공했지만 DB 저장 실패 (수동 처리 필요)
      return {
        success: true,
        message: "결제는 완료되었으나 정보 저장에 실패했습니다. 고객센터에 문의해주세요.",
        paymentKey: paymentData.paymentKey,
      };
    }

    console.log("[confirmPayment] ✅ 결제 정보 저장 완료");

    // 7. 주문 상태 업데이트
    console.log("[confirmPayment] 주문 상태 업데이트 중...");
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "paid", // 결제완료
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("[confirmPayment] ❌ 주문 상태 업데이트 실패:", updateError);
    } else {
      console.log("[confirmPayment] ✅ 주문 상태 업데이트 완료");
    }

    console.log("[confirmPayment] 🎉 결제 승인 프로세스 완료!");
    
    return {
      success: true,
      message: "결제가 완료되었습니다.",
      paymentKey: paymentData.paymentKey,
      orderId: order.order_number, // 주문번호 반환
    };
  } catch (error) {
    console.error("[confirmPayment] ❌ 예외 발생:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "결제 처리 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 결제 정보 조회
 */
export async function getPaymentByOrderId(orderId: string) {
  console.log("[getPaymentByOrderId] 결제 정보 조회:", orderId);

  try {
    const { userId } = await auth();
    if (!userId) {
      return null;
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (error) {
      console.error("[getPaymentByOrderId] 조회 실패:", error);
      return null;
    }

    console.log("[getPaymentByOrderId] ✅ 결제 정보 조회 완료");
    return data;
  } catch (error) {
    console.error("[getPaymentByOrderId] 예외 발생:", error);
    return null;
  }
}

