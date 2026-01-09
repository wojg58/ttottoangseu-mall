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
        payment_status: "PAID", // 결제완료
        fulfillment_status: "UNFULFILLED",
        status: "PAID", // 하위 호환성
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("[confirmPayment] ❌ 주문 상태 업데이트 실패:", updateError);
    } else {
      console.log("[confirmPayment] ✅ 주문 상태 업데이트 완료");
    }

    // 8. 네이버 동기화 큐 적재 (옵션 단위, AWS Worker용)
    console.log("[confirmPayment] 네이버 동기화 큐 적재 중 (옵션 단위)...");
    try {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          quantity,
          variant_id,
          product:products(id, smartstore_product_id, stock),
          variant:product_variants(
            id,
            stock,
            smartstore_option_id,
            smartstore_channel_product_no
          )
        `)
        .eq("order_id", orderId);

      if (orderItems) {
        const queueData: Array<{
          product_id: string;
          variant_id: string | null;
          smartstore_id: string;
          smartstore_option_id: number | null;
          target_stock: number;
          status: string;
        }> = [];

        for (const item of orderItems) {
          // Supabase 관계형 쿼리 결과가 배열로 추론될 수 있으므로 unknown을 거쳐 타입 단언
          const product = (item.product as unknown) as { id: string; smartstore_product_id: string | null; stock: number } | null;
          const variant = (item.variant as unknown) as {
            id: string;
            stock: number;
            smartstore_option_id: number | null;
            smartstore_channel_product_no: number | null;
          } | null;

          // 네이버 연동 상품만 처리
          if (!product || !product.smartstore_product_id) {
            continue;
          }

          // 옵션이 있고 스마트스토어 옵션 매핑이 있는 경우 → 옵션 단위 동기화
          if (variant && variant.smartstore_option_id && variant.smartstore_channel_product_no) {
            queueData.push({
              product_id: product.id,
              variant_id: variant.id,
              smartstore_id: variant.smartstore_channel_product_no.toString(),
              smartstore_option_id: variant.smartstore_option_id,
              target_stock: variant.stock, // 옵션 재고 (이미 차감됨)
              status: 'pending'
            });
            console.log(
              `[confirmPayment] 옵션 단위 큐 추가: ${product.id} / variant ${variant.id} → 스마트스토어 옵션 ${variant.smartstore_option_id} (재고: ${variant.stock})`
            );
          } else {
            // 옵션이 없거나 매핑이 없는 경우 → 상품 단위 동기화
            queueData.push({
              product_id: product.id,
              variant_id: null,
              smartstore_id: product.smartstore_product_id,
              smartstore_option_id: null,
              target_stock: product.stock, // 상품 재고 (이미 차감됨)
              status: 'pending'
            });
            console.log(
              `[confirmPayment] 상품 단위 큐 추가: ${product.id} → 스마트스토어 ${product.smartstore_product_id} (재고: ${product.stock})`
            );
          }
        }

        if (queueData.length > 0) {
          const { error: queueError } = await supabase
            .from('naver_sync_queue')
            .insert(queueData);

          if (queueError) {
            console.error("[confirmPayment] ❌ 큐 적재 실패:", queueError);
          } else {
            console.log(`[confirmPayment] ✅ AWS Worker용 큐 적재 완료: ${queueData.length}건`);
          }
        } else {
          console.log("[confirmPayment] 네이버 연동 상품 없음 (큐 적재 스킵)");
        }
      }
    } catch (e) {
      console.error("[confirmPayment] ❌ 큐 적재 실패 (결제는 성공):", e);
      // 큐 적재 실패해도 결제는 성공했으므로 계속 진행
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

