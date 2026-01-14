/**
 * @file app/api/webhooks/toss/route.ts
 * @description 토스페이먼츠 웹훅 수신 API
 * 
 * 주요 기능:
 * 1. 토스페이먼츠 웹훅 이벤트 수신
 * 2. 시그니처 검증 (secret 필드)
 * 3. 중복 처리 방지 (idempotency)
 * 4. 결제 상태에 따른 주문 상태 업데이트
 * 
 * 웹훅 이벤트 타입:
 * - PAYMENT_STATUS_CHANGED: 결제 상태 변경 (DONE, CANCELED 등)
 * - DEPOSIT_CALLBACK: 가상계좌 입금 완료
 * 
 * @dependencies
 * - @/lib/supabase/service-role: Supabase 서비스 롤 클라이언트
 * - @/actions/orders: 재고 차감 함수
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import logger from "@/lib/logger";
import { logError } from "@/lib/error-handler";
// crypto는 시그니처 검증에 사용 (현재는 secret 필드로 검증)

interface TossWebhookEvent {
  eventType: string;
  createdAt: string;
  data: {
    paymentKey?: string;
    orderId: string;
    status: string;
    requestedAt?: string;
    approvedAt?: string;
    canceledAt?: string;
    cancelReason?: string;
    secret?: string;
    [key: string]: any;
  };
}

/**
 * 웹훅 시그니처 검증
 * 토스페이먼츠는 secret 필드를 통해 웹훅의 진위성을 확인합니다.
 * 실제 운영에서는 토스페이먼츠 대시보드에서 설정한 웹훅 시크릿과 비교해야 합니다.
 */
function verifyWebhookSignature(
  event: TossWebhookEvent,
  webhookSecret?: string,
): boolean {
  // secret 필드가 있으면 검증 (토스페이먼츠에서 제공)
  if (event.data.secret) {
    // 실제 운영에서는 토스페이먼츠 대시보드에서 설정한 웹훅 시크릿과 비교
    // 현재는 secret 필드가 존재하면 검증 통과로 처리
    // TODO: 토스페이먼츠 대시보드에서 웹훅 시크릿 설정 후 검증 로직 강화
    if (webhookSecret && event.data.secret !== webhookSecret) {
      logger.warn("웹훅 시그니처 불일치");
      return false;
    }
    return true;
  }

  // secret 필드가 없으면 기본 검증 (개발 환경)
  logger.warn("웹훅 secret 필드가 없습니다. 개발 환경일 수 있습니다.");
  return true;
}

/**
 * 웹훅 이벤트 중복 처리 방지 (Idempotency)
 * 같은 이벤트를 여러 번 처리하지 않도록 paymentKey와 이벤트 타입을 조합하여 확인합니다.
 */
async function checkEventProcessed(
  supabase: ReturnType<typeof getServiceRoleClient>,
  paymentKey: string,
  eventType: string,
): Promise<boolean> {
  if (!paymentKey) {
    return false; // paymentKey가 없으면 중복 체크 불가
  }

  // payments 테이블에서 해당 paymentKey로 결제 정보 조회
  const { data: payment } = await supabase
    .from("payments")
    .select("id, metadata")
    .eq("payment_key", paymentKey)
    .single();

  if (!payment) {
    return false; // 결제 정보가 없으면 아직 처리되지 않은 것으로 간주
  }

  // metadata에 웹훅 처리 기록이 있는지 확인
  const metadata = payment.metadata as { 
    webhookProcessed?: boolean;
    webhookEvents?: string[];
  } | null;

  if (!metadata) {
    return false;
  }

  // 이벤트 타입별로 처리 여부 확인
  const processedEvents = metadata.webhookEvents || [];
  return processedEvents.includes(eventType);
}

/**
 * 웹훅 이벤트 처리 기록 저장 (Idempotency)
 */
async function markEventProcessed(
  supabase: ReturnType<typeof getServiceRoleClient>,
  paymentKey: string,
  eventType: string,
): Promise<void> {
  if (!paymentKey) {
    return;
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, metadata")
    .eq("payment_key", paymentKey)
    .single();

  if (payment) {
    const metadata = (payment.metadata as Record<string, any>) || {};
    
    // 이벤트 타입별로 처리 기록 저장
    if (!metadata.webhookEvents) {
      metadata.webhookEvents = [];
    }
    
    if (!metadata.webhookEvents.includes(eventType)) {
      metadata.webhookEvents.push(eventType);
    }
    
    metadata.webhookProcessed = true;
    metadata.webhookProcessedAt = new Date().toISOString();
    metadata.lastWebhookEvent = eventType;

    await supabase
      .from("payments")
      .update({ metadata })
      .eq("id", payment.id);
  }
}

/**
 * 결제 완료 후 장바구니에서 주문 아이템 제거
 * 주문된 수량만큼만 장바구니에서 차감 (부분 결제 고려)
 */
async function removeOrderItemsFromCart(
  supabase: ReturnType<typeof getServiceRoleClient>,
  orderId: string,
): Promise<{ success: boolean; message?: string }> {
  logger.group(`[removeOrderItemsFromCart] 장바구니에서 주문 아이템 제거: Order ID ${orderId}`);

  try {
    // 1. 주문 정보 조회 (user_id 포함)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      logger.error("주문 조회 실패:", orderError);
      logger.groupEnd();
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    // 2. 주문 아이템 조회
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("product_id, variant_id, quantity")
      .eq("order_id", orderId);

    if (itemsError) {
      logger.error("주문 아이템 조회 실패:", itemsError);
      logger.groupEnd();
      return { success: false, message: "주문 아이템을 조회할 수 없습니다." };
    }

    if (!orderItems || orderItems.length === 0) {
      logger.info("주문 아이템이 없습니다. 장바구니 제거 스킵");
      logger.groupEnd();
      return { success: true };
    }

    logger.info(`주문 아이템 ${orderItems.length}개 발견`);

    // 3. 사용자의 장바구니 조회
    const { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", order.user_id)
      .single();

    if (cartError || !cart) {
      logger.warn("장바구니를 찾을 수 없습니다. (이미 비어있을 수 있음)");
      logger.groupEnd();
      return { success: true }; // 장바구니가 없어도 성공으로 처리
    }

    // 4. 각 주문 아이템에 대해 장바구니에서 제거
    let removedCount = 0;
    let updatedCount = 0;

    for (const orderItem of orderItems) {
      logger.info("장바구니 아이템 처리 시작", {
        productId: orderItem.product_id,
        variantId: orderItem.variant_id,
        orderQuantity: orderItem.quantity,
      });

      // 장바구니에서 해당 상품 찾기
      const { data: cartItem, error: cartItemError } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", orderItem.product_id)
        .eq("variant_id", orderItem.variant_id ?? null)
        .maybeSingle();

      if (cartItemError) {
        logger.warn("장바구니 아이템 조회 실패:", cartItemError);
        continue;
      }

      if (!cartItem) {
        logger.info("장바구니에 해당 상품이 없습니다. (이미 제거되었을 수 있음)");
        continue;
      }

      // 주문 수량만큼 차감
      const newQuantity = cartItem.quantity - orderItem.quantity;

      if (newQuantity <= 0) {
        // 수량이 0 이하가 되면 삭제
        const { error: deleteError } = await supabase
          .from("cart_items")
          .delete()
          .eq("id", cartItem.id);

        if (deleteError) {
          logger.error("장바구니 아이템 삭제 실패:", deleteError);
        } else {
          logger.info("장바구니 아이템 삭제 완료", {
            cartItemId: cartItem.id,
            removedQuantity: cartItem.quantity,
          });
          removedCount++;
        }
      } else {
        // 수량 업데이트
        const { error: updateError } = await supabase
          .from("cart_items")
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cartItem.id);

        if (updateError) {
          logger.error("장바구니 아이템 수량 업데이트 실패:", updateError);
        } else {
          logger.info("장바구니 아이템 수량 업데이트 완료", {
            cartItemId: cartItem.id,
            oldQuantity: cartItem.quantity,
            newQuantity,
            removedQuantity: orderItem.quantity,
          });
          updatedCount++;
        }
      }
    }

    logger.info("✅ 장바구니에서 주문 아이템 제거 완료", {
      totalOrderItems: orderItems.length,
      removedCount,
      updatedCount,
    });
    logger.groupEnd();
    return { success: true };
  } catch (error) {
    logger.error("장바구니에서 주문 아이템 제거 예외:", error);
    logger.groupEnd();
    return { success: false, message: "장바구니에서 주문 아이템 제거 중 오류가 발생했습니다." };
  }
}

/**
 * 결제 상태에 따른 주문 상태 업데이트
 */
async function updateOrderStatusFromWebhook(
  supabase: ReturnType<typeof getServiceRoleClient>,
  orderId: string,
  paymentStatus: string,
  paymentKey: string,
): Promise<{ success: boolean; message?: string }> {
  logger.group(`[updateOrderStatusFromWebhook] 주문 상태 업데이트: Order ID ${orderId}, Status ${paymentStatus}`);

  try {
    // 주문 조회
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, payment_status, fulfillment_status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      logger.error("주문 조회 실패:", orderError);
      logger.groupEnd();
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    // 결제 상태에 따른 주문 상태 업데이트
    let updateData: {
      payment_status?: string;
      fulfillment_status?: string;
      status?: string;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    switch (paymentStatus) {
      case "DONE":
        // 결제 완료: payment_status=PAID, fulfillment_status=UNFULFILLED
        if (order.payment_status !== "PAID") {
          updateData.payment_status = "PAID";
          updateData.fulfillment_status = "UNFULFILLED";
          updateData.status = "PAID"; // 하위 호환성

          // 재고 차감 (결제 성공 시점에만 수행, 웹훅에서도 동일하게 처리)
          logger.info("재고 차감 시작...");
          const { deductOrderStock } = await import("@/actions/orders");
          const stockResult = await deductOrderStock(orderId, supabase);

          if (!stockResult.success) {
            logger.error("⚠️ 재고 차감 실패:", stockResult.message);
            // 재고 차감 실패 시에도 결제는 완료되었으므로 경고만 로그
            // 수동으로 재고를 확인하고 차감해야 함
          } else {
            logger.info("✅ 재고 차감 완료");
          }

          // 장바구니에서 주문 아이템 제거 (결제 완료 후)
          logger.info("장바구니에서 주문 아이템 제거 시작...");
          const cartResult = await removeOrderItemsFromCart(supabase, orderId);

          if (!cartResult.success) {
            logger.error("⚠️ 장바구니에서 주문 아이템 제거 실패:", cartResult.message);
            // 장바구니 제거 실패 시에도 결제는 완료되었으므로 경고만 로그
          } else {
            logger.info("✅ 장바구니에서 주문 아이템 제거 완료");
          }
        } else {
          logger.info("이미 결제 완료된 주문입니다. 재고 차감은 이미 수행되었을 수 있습니다.");
        }
        break;

      case "CANCELED":
        // 결제 취소: payment_status=CANCELED, fulfillment_status=CANCELED
        updateData.payment_status = "CANCELED";
        updateData.fulfillment_status = "CANCELED";
        updateData.status = "CANCELED"; // 하위 호환성
        break;

      case "PARTIAL_CANCELED":
        // 부분 취소: payment_status는 그대로, 취소 정보만 기록
        // TODO: 부분 취소 처리 로직 추가
        logger.warn("부분 취소는 아직 처리하지 않습니다.");
        break;

      default:
        logger.warn(`알 수 없는 결제 상태: ${paymentStatus}`);
        logger.groupEnd();
        return { success: false, message: `알 수 없는 결제 상태: ${paymentStatus}` };
    }

    // 주문 상태 업데이트
    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      logger.error("주문 상태 업데이트 실패:", updateError);
      logger.groupEnd();
      return { success: false, message: "주문 상태 업데이트에 실패했습니다." };
    }

    logger.info("✅ 주문 상태 업데이트 완료");
    logger.groupEnd();
    return { success: true };
  } catch (error) {
    logger.error("주문 상태 업데이트 예외:", error);
    logger.groupEnd();
    return { success: false, message: "주문 상태 업데이트 중 오류가 발생했습니다." };
  }
}

export async function POST(request: NextRequest) {
  logger.group("[POST /api/webhooks/toss] 토스페이먼츠 웹훅 수신");

  try {
    // 1. 요청 본문 파싱
    const event: TossWebhookEvent = await request.json();
    logger.info("웹훅 이벤트 수신:", {
      eventType: event.eventType,
      orderId: event.data.orderId,
      status: event.data.status,
      paymentKey: event.data.paymentKey?.substring(0, 10) + "...",
    });

    // 2. 필수 필드 검증
    if (!event.eventType || !event.data || !event.data.orderId) {
      logger.error("웹훅 이벤트 필수 필드 누락");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "필수 필드가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 3. 시그니처 검증
    const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;
    if (!verifyWebhookSignature(event, webhookSecret)) {
      logger.error("웹훅 시그니처 검증 실패");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "웹훅 시그니처 검증에 실패했습니다." },
        { status: 401 }
      );
    }

    logger.info("✅ 웹훅 시그니처 검증 완료");

    // 4. Supabase 서비스 롤 클라이언트 생성
    const supabase = getServiceRoleClient();

    // 5. 중복 처리 방지 (idempotency)
    const paymentKey = event.data.paymentKey;
    if (paymentKey) {
      const isProcessed = await checkEventProcessed(supabase, paymentKey, event.eventType);

      if (isProcessed) {
        logger.warn("이미 처리된 웹훅 이벤트:", { 
          paymentKey: paymentKey.substring(0, 10) + "...",
          eventType: event.eventType 
        });
        logger.groupEnd();
        return NextResponse.json(
          { success: true, message: "이미 처리된 이벤트입니다." },
          { status: 200 }
        );
      }
    }

    // 6. 이벤트 타입에 따른 처리
    if (event.eventType === "PAYMENT_STATUS_CHANGED") {
      const { orderId, status, paymentKey } = event.data;

      if (!orderId || !status) {
        logger.error("PAYMENT_STATUS_CHANGED 이벤트 필수 필드 누락");
        logger.groupEnd();
        return NextResponse.json(
          { success: false, message: "필수 필드가 누락되었습니다." },
          { status: 400 }
        );
      }

      // 주문 상태 업데이트
      const updateResult = await updateOrderStatusFromWebhook(
        supabase,
        orderId,
        status,
        paymentKey || "",
      );

      if (!updateResult.success) {
        logger.error("주문 상태 업데이트 실패:", updateResult.message);
        // 웹훅은 항상 200을 반환해야 함 (재시도 방지)
        logger.groupEnd();
        return NextResponse.json(
          { success: false, message: updateResult.message },
          { status: 200 } // 웹훅은 항상 200 반환
        );
      }

      // 이벤트 처리 기록 저장 (idempotency)
      if (paymentKey) {
        await markEventProcessed(supabase, paymentKey, event.eventType);
      }

      // 결제 완료(DONE) 시 관리자 알림 발송
      if (status === "DONE") {
        try {
          // 주문 정보 조회 (알림 발송용)
          const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("order_number, total_amount, created_at")
            .eq("id", orderId)
            .single();

          if (!orderError && order) {
            // 알림 발송 (비동기, 실패해도 웹훅은 성공 응답)
            logger.info("[웹훅] 관리자 알림 발송 시작:", {
              orderId,
              orderNo: order.order_number,
              amount: order.total_amount,
              createdAt: order.created_at,
            });
            
            const { notifyAdminOnOrderPaid } = await import("@/lib/notifications/notifyAdminOnOrderPaid");
            notifyAdminOnOrderPaid({
              orderId,
              orderNo: order.order_number,
              amount: Number(order.total_amount),
              createdAtUtc: order.created_at,
            })
              .then((result) => {
                logger.info("[웹훅] 관리자 알림 발송 완료:", {
                  success: result.success,
                  alimtalkSent: result.alimtalkSent,
                  emailSent: result.emailSent,
                  errors: result.errors,
                });
              })
              .catch((error) => {
                // 알림 실패는 로그만 남기고 웹훅 흐름에는 영향 없음
                logger.error("[웹훅] 관리자 알림 발송 실패 (무시됨):", {
                  error: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                });
              });
          } else {
            logger.warn("[웹훅] 주문 정보 조회 실패, 알림 발송 스킵:", orderError);
          }
        } catch (error) {
          // 알림 발송 중 예외는 로그만 남기고 웹훅 흐름에는 영향 없음
          logger.error("[웹훅] 관리자 알림 발송 중 예외 (무시됨):", error);
        }
      }

      logger.info("✅ 웹훅 이벤트 처리 완료");
      logger.groupEnd();
      return NextResponse.json(
        { success: true, message: "웹훅 이벤트가 처리되었습니다." },
        { status: 200 }
      );
    } else if (event.eventType === "DEPOSIT_CALLBACK") {
      // 가상계좌 입금 완료 처리
      logger.info("가상계좌 입금 완료 이벤트:", event.data);
      // TODO: 가상계좌 입금 완료 처리 로직 추가
      logger.groupEnd();
      return NextResponse.json(
        { success: true, message: "가상계좌 입금 완료 이벤트를 수신했습니다." },
        { status: 200 }
      );
    } else {
      logger.warn(`처리하지 않는 이벤트 타입: ${event.eventType}`);
      logger.groupEnd();
      return NextResponse.json(
        { success: true, message: `처리하지 않는 이벤트 타입: ${event.eventType}` },
        { status: 200 }
      );
    }
  } catch (error) {
    logError(error, { api: "/api/webhooks/toss", step: "unexpected_error" });
    logger.error("웹훅 처리 예외:", error);
    logger.groupEnd();
    
    // 웹훅은 항상 200을 반환해야 함 (재시도 방지)
    // 실제 에러는 로그로 기록하고, 토스페이먼츠에는 성공 응답 반환
    return NextResponse.json(
      { success: false, message: "웹훅 처리 중 오류가 발생했습니다." },
      { status: 200 } // 웹훅은 항상 200 반환
    );
  }
}

