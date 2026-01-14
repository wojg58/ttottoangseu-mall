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
import {
  rateLimitMiddleware,
  rateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  paymentConfirmSchema,
  validateSchema,
} from "@/lib/validation";
import {
  sanitizeError,
  sanitizeDatabaseError,
  logError,
} from "@/lib/error-handler";
import { normalizePaymentMethod } from "@/lib/utils/payment-method";

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

  // Rate Limiting 체크
  const rateLimitResult = await rateLimitMiddleware(
    request,
    RATE_LIMITS.PAYMENT.limit,
    RATE_LIMITS.PAYMENT.window,
  );

  if (!rateLimitResult?.success) {
    logger.warn("[RateLimit] 결제 API 요청 제한 초과");
    logger.groupEnd();
    return NextResponse.json(
      { success: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimitResult),
      },
    );
  }

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

    // 2. 요청 본문 파싱 및 검증
    const body = await request.json();
    const validationResult = validateSchema(paymentConfirmSchema, body);

    if (validationResult.success === false) {
      logger.error("[Validation] 결제 승인 요청 검증 실패:", validationResult.error);
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: validationResult.error },
        { status: 400 }
      );
    }

    const { paymentKey, orderId, amount: amountNumber } = validationResult.data;

    logger.info("결제 승인 요청:", {
      paymentKey: paymentKey.substring(0, 10) + "...",
      orderId,
      amount: amountNumber,
    });

    // 4. Supabase 서비스 롤 클라이언트 생성 (RLS 우회)
    const supabase = getServiceRoleClient();

    // 5. 사용자 ID 조회 (Clerk userId -> users.id UUID 변환)
    logger.info("[confirmPayment] clerkUserId=" + clerkUserId);
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (!user) {
      logger.error("[confirmPayment] 사용자를 찾을 수 없음", {
        clerkUserId,
      });
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    
    logger.info("[confirmPayment] dbUserId(users.id)=" + user.id);

    // 6. 주문 정보 조회 및 검증
    logger.info("[confirmPayment] 주문 정보 조회 중...", {
      orderId,
      dbUserId: user.id,
      queryFilter: "order.user_id == " + user.id,
    });
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, total_amount, payment_status, fulfillment_status, status, order_number, created_at")
      .eq("id", orderId)
      .eq("user_id", user.id) // users.id (UUID)로 조회
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
      paymentStatus: order.payment_status || order.status,
      fulfillmentStatus: order.fulfillment_status,
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

    // 8. 주문 상태 검증 (PENDING 상태만 결제 가능)
    const paymentStatus = order.payment_status || order.status;
    if (paymentStatus !== "PENDING") {
      if (paymentStatus === "PAID") {
        logger.warn("이미 결제 완료된 주문");
        logger.groupEnd();
        return NextResponse.json(
          { success: true, message: "이미 결제가 완료된 주문입니다.", orderId: order.order_number },
          { status: 200 }
        );
      } else {
        logger.error("결제 불가능한 주문 상태:", { paymentStatus });
        logger.groupEnd();
        return NextResponse.json(
          { success: false, message: `결제할 수 없는 주문 상태입니다. (상태: ${paymentStatus})` },
          { status: 400 }
        );
      }
    }

    // 9. payment_key 중복 체크 (중복 결제 방지)
    logger.info("payment_key 중복 체크 중...");
    const { data: existingPayment, error: paymentCheckError } = await supabase
      .from("payments")
      .select("id, order_id, status, approved_at")
      .eq("payment_key", paymentKey)
      .maybeSingle();

    if (paymentCheckError) {
      logError(paymentCheckError, { api: "/api/payments/toss/confirm", step: "check_existing_payment" });
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 정보 확인 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (existingPayment) {
      // 같은 payment_key로 이미 결제가 처리된 경우
      if (existingPayment.order_id === orderId) {
        logger.warn("이미 처리된 payment_key (같은 주문):", {
          paymentId: existingPayment.id,
          status: existingPayment.status,
        });
        logger.groupEnd();
        return NextResponse.json(
          {
            success: true,
            message: "이미 처리된 결제입니다.",
            orderId: order.order_number,
          },
          { status: 200 }
        );
      } else {
        // 다른 주문에 사용된 payment_key (보안 위험)
        logError(
          new Error("Payment key already used for different order"),
          {
            api: "/api/payments/toss/confirm",
            step: "duplicate_payment_key_check",
            paymentKey: paymentKey.substring(0, 10) + "...",
            existingOrderId: existingPayment.order_id,
            requestOrderId: orderId,
          }
        );
        logger.error("보안 경고: 다른 주문에 사용된 payment_key", {
          existingOrderId: existingPayment.order_id,
          requestOrderId: orderId,
        });
        logger.groupEnd();
        return NextResponse.json(
          { success: false, message: "이미 사용된 결제 키입니다." },
          { status: 400 }
        );
      }
    }

    logger.info("✅ payment_key 중복 체크 완료 (새로운 결제)");

    // 10. 토스페이먼츠 승인 API 호출
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

    // 11. 토스페이먼츠 응답 상태 검증
    if (paymentData.status !== "DONE") {
      logger.error("토스페이먼츠 결제 상태가 DONE이 아님:", { status: paymentData.status });
      logger.groupEnd();
      return NextResponse.json(
        {
          success: false,
          message: `결제 상태가 올바르지 않습니다. (상태: ${paymentData.status})`,
        },
        { status: 400 }
      );
    }

    // 12. 결제 금액 재검증 (토스페이먼츠 응답과 비교)
    if (paymentData.totalAmount !== amountNumber || paymentData.totalAmount !== order.total_amount) {
      logError(
        new Error("Payment amount mismatch with Toss response"),
        {
          api: "/api/payments/toss/confirm",
          step: "amount_verification",
          requestAmount: amountNumber,
          orderAmount: order.total_amount,
          tossAmount: paymentData.totalAmount,
        }
      );
      logger.error("결제 금액 불일치 (토스페이먼츠 응답):", {
        requestAmount: amountNumber,
        orderAmount: order.total_amount,
        tossAmount: paymentData.totalAmount,
      });
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 금액이 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // 13. 결제 정보 데이터베이스 저장 (트랜잭션 처리)
    logger.info("결제 정보 데이터베이스 저장 중...");
    
    // payment_key 중복 재확인 (동시성 문제 방지)
    const { data: duplicateCheck, error: duplicateCheckError } = await supabase
      .from("payments")
      .select("id")
      .eq("payment_key", paymentData.paymentKey)
      .maybeSingle();

    if (duplicateCheckError) {
      logError(duplicateCheckError, { api: "/api/payments/toss/confirm", step: "duplicate_check_before_insert" });
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "결제 정보 확인 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (duplicateCheck) {
      logger.warn("동시 요청으로 인한 중복 결제 시도 감지:", {
        paymentId: duplicateCheck.id,
      });
      logger.groupEnd();
      return NextResponse.json(
        {
          success: true,
          message: "이미 처리된 결제입니다.",
          orderId: order.order_number,
        },
        { status: 200 }
      );
    }

    // requested_at와 approved_at 값 확인 및 기본값 설정
    const requestedAt = paymentData.requestedAt || new Date().toISOString();
    const approvedAt = paymentData.approvedAt || new Date().toISOString();

    // 결제 수단 정규화 (한글 "카드" → 영어 "card" 변환)
    const normalizedMethod = normalizePaymentMethod(paymentData.method);

    logger.info("결제 정보 저장 데이터:", {
      orderId,
      paymentKey: paymentData.paymentKey.substring(0, 10) + "...",
      originalMethod: paymentData.method,
      normalizedMethod,
      amount: paymentData.totalAmount,
      status: paymentData.status.toLowerCase(),
      requestedAt,
      approvedAt,
    });

    const { data: insertedPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: orderId,
        payment_key: paymentData.paymentKey,
        method: normalizedMethod, // 한글/영어 → 영어 소문자 변환 (카드/CARD → card)
        amount: paymentData.totalAmount,
        status: paymentData.status.toLowerCase(), // 대문자 → 소문자 변환 (DONE → done)
        requested_at: requestedAt,
        approved_at: approvedAt,
        metadata: paymentData, // payment_data → metadata로 수정 (전체 응답 데이터 저장)
      })
      .select("id")
      .single();

    if (paymentError) {
      // 상세한 에러 정보 로깅
      logger.error("❌ 결제 정보 저장 실패 - 상세 에러:", {
        errorCode: paymentError.code,
        errorMessage: paymentError.message,
        errorDetails: paymentError.details,
        errorHint: paymentError.hint,
        insertData: {
          orderId,
          paymentKey: paymentData.paymentKey.substring(0, 10) + "...",
          method: paymentData.method.toLowerCase(),
          amount: paymentData.totalAmount,
          status: paymentData.status.toLowerCase(),
          requestedAt,
          approvedAt,
        },
      });
      logError(paymentError, { api: "/api/payments/toss/confirm", step: "insert_payment" });
      
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

    logger.info("✅ 결제 정보 저장 완료:", { paymentId: insertedPayment.id });

    // 14. 재고 차감 (결제 성공 시점에만 수행)
    logger.info("재고 차감 시작...");
    const { deductOrderStock } = await import("@/actions/orders");
    const stockResult = await deductOrderStock(orderId, supabase);
    
    if (!stockResult.success) {
      logError(new Error(stockResult.message || "재고 차감 실패"), { api: "/api/payments/toss/confirm", step: "deduct_stock" });
      logger.error("⚠️ 재고 차감 실패:", stockResult.message);
      // 재고 차감 실패 시에도 결제는 완료되었으므로 경고만 로그
      // 수동으로 재고를 확인하고 차감해야 함
    } else {
      logger.info("✅ 재고 차감 완료");
    }

    // 15. 주문 상태 업데이트 (결제 성공: payment_status=PAID, fulfillment_status=UNFULFILLED) - 원자성 보장
    logger.info("주문 상태 업데이트 중...");
    // 결제 승인 시간을 paid_at에 저장 (approved_at 시간 사용)
    const paidAt = approvedAt || new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "PAID",
        fulfillment_status: "UNFULFILLED",
        status: "PAID", // 하위 호환성
        paid_at: paidAt, // 결제 승인 시간 저장
        updated_at: new Date().toISOString(), // 주문 정보 업데이트 시간
      })
      .eq("id", orderId)
      .or(`payment_status.eq.PENDING,status.eq.PENDING`); // PENDING 상태인 경우에만 업데이트 (낙관적 잠금)

    if (updateError) {
      logError(updateError, { api: "/api/payments/toss/confirm", step: "update_order_status" });
      logger.error("주문 상태 업데이트 실패:", updateError);
      
      // 주문 상태 업데이트 실패 시 결제 정보는 이미 저장됨
      // 주문 상태를 수동으로 확인해야 함
      logger.warn("⚠️ 결제는 완료되었으나 주문 상태 업데이트 실패. 수동 확인 필요:", {
        paymentId: insertedPayment.id,
        orderId: orderId,
      });
    } else {
      logger.info("✅ 주문 상태 업데이트 완료 (PAID)");
    }

    // 16. 관리자 알림 발송 (이메일/알림톡)
    logger.info("[POST /api/payments/toss/confirm] 관리자 알림 발송 시작...");
    logger.info("[ALIMTALK_TRACE] /api/payments/toss/confirm -> notifyAdminOnOrderPaid called");
    try {
      const { notifyAdminOnOrderPaid } = await import("@/lib/notifications/notifyAdminOnOrderPaid");
      const notificationResult = await notifyAdminOnOrderPaid({
        orderId: orderId,
        orderNo: order.order_number,
        amount: order.total_amount,
        createdAtUtc: order.created_at,
      });

      if (notificationResult.success) {
        logger.info("[POST /api/payments/toss/confirm] ✅ 관리자 알림 발송 완료:", {
          alimtalkSent: notificationResult.alimtalkSent,
          emailSent: notificationResult.emailSent,
        });
      } else {
        logger.warn("[POST /api/payments/toss/confirm] ⚠️ 관리자 알림 발송 실패 (결제는 성공):", notificationResult.errors);
      }
    } catch (e) {
      logger.error("[POST /api/payments/toss/confirm] ❌ 관리자 알림 발송 예외 (결제는 성공):", e);
      // 알림 발송 실패해도 결제는 성공했으므로 계속 진행
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
      transfer: paymentData.transfer, // 실시간 계좌이체 정보 추가
    });
  } catch (error) {
    logError(error, { api: "/api/payments/toss/confirm", step: "unexpected_error" });
    logger.groupEnd();
    return NextResponse.json(
      {
        success: false,
        message: sanitizeError(error, "결제 처리 중 오류가 발생했습니다."),
      },
      { status: 500 }
    );
  }
}

