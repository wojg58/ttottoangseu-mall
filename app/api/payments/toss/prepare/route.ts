/**
 * @file app/api/payments/toss/prepare/route.ts
 * @description 토스페이먼츠 결제 준비 API
 *
 * 주요 기능:
 * 1. 주문 생성 (orderId)
 * 2. 서버에서 금액 재계산 및 검증
 * 3. orderId, amount, orderName, customerName, customerEmail 반환
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
  paymentPrepareSchema,
  validateSchema,
} from "@/lib/validation";

// 주문번호 생성
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${year}${month}${day}-${random}`;
}

export async function POST(request: NextRequest) {
  logger.group("[POST /api/payments/toss/prepare] 결제 준비 시작");

  try {
    // 1. 인증 확인
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      logger.error("인증되지 않은 사용자");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    logger.info("✅ 사용자 인증 완료:", clerkUserId);

    // 2. 클라이언트에서 전달된 금액 (검증용, 신뢰하지 않음)
    const body = await request.json();
    const validationResult = validateSchema(paymentPrepareSchema, body);

    if (validationResult.success === false) {
      logger.error("[Validation] 결제 준비 요청 검증 실패:", {
        error: validationResult.error,
        body: JSON.stringify(body, null, 2),
        nodeEnv: process.env.NODE_ENV,
      });
      logger.groupEnd();
      return NextResponse.json(
        { 
          success: false, 
          message: validationResult.error,
          errorType: "VALIDATION_ERROR",
          details: "결제 준비 요청 파라미터 검증 실패",
        },
        { status: 400 }
      );
    }

    const clientAmount = validationResult.data.amount;
    const {
      ordererName,
      ordererPhone,
      ordererEmail,
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingZipCode,
      shippingMemo,
    } = validationResult.data;
    
    logger.info("클라이언트에서 전달된 금액:", clientAmount);
    logger.info("주문자 정보:", {
      name: ordererName,
      phone: ordererPhone,
      email: ordererEmail,
    });
    logger.info("배송 정보:", {
      name: shippingName,
      phone: shippingPhone,
      address: shippingAddress,
      zipCode: shippingZipCode,
      memo: shippingMemo,
    });

    // 3. Supabase 서비스 롤 클라이언트 생성 (RLS 우회)
    const supabase = getServiceRoleClient();

    // 4. 사용자 ID 조회
    const { data: initialUser, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("clerk_user_id", clerkUserId)
      .is("deleted_at", null)
      .maybeSingle();

    let user = initialUser;

    // 사용자가 없으면 동기화 시도
    if (!user && !userError) {
      logger.info("사용자가 없음 - 동기화 시도");
      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(clerkUserId);

        if (clerkUser) {
          logger.info("Clerk 사용자 정보 조회 성공:", {
            id: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
          });

          const serviceSupabase = getServiceRoleClient();
          const userData = {
            clerk_user_id: clerkUser.id,
            name:
              clerkUser.fullName ||
              clerkUser.username ||
              clerkUser.emailAddresses[0]?.emailAddress ||
              "Unknown",
            email: clerkUser.emailAddresses[0]?.emailAddress || "",
            role: "customer",
          };

          const { data: newUser, error: insertError } = await serviceSupabase
            .from("users")
            .insert(userData)
            .select("id, name, email")
            .single();

          if (!insertError && newUser) {
            logger.info("사용자 동기화 성공:", newUser.id);
            user = newUser;
          } else {
            logger.error("사용자 동기화 실패:", insertError);
          }
        } else {
          logger.warn("Clerk 사용자 정보 조회 실패");
        }
      } catch (syncError) {
        logger.error("사용자 동기화 중 예외 발생:", syncError);
      }

      // 동기화 후 다시 조회
      if (!user) {
        const { data: retryUser } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("clerk_user_id", clerkUserId)
          .is("deleted_at", null)
          .maybeSingle();
        user = retryUser || undefined;
      }
    }

    if (!user) {
      logger.error("사용자를 찾을 수 없음 (동기화 시도 후에도 실패)");
      logger.groupEnd();
      return NextResponse.json(
        {
          success: false,
          message: "사용자를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 404 },
      );
    }

    if (userError) {
      logger.error("사용자 조회 에러:", userError);
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "사용자 정보 조회 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }

    logger.info("✅ 사용자 정보 조회 완료:", {
      userId: user.id,
      name: user.name,
      email: user.email,
    });

    // 5. 장바구니 조회
    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!cart) {
      logger.error("장바구니가 비어있음", {
        clerkUserId,
        userExists: !!user,
        userId: user?.id,
        nodeEnv: process.env.NODE_ENV,
      });
      logger.groupEnd();
      return NextResponse.json(
        { 
          success: false, 
          message: "장바구니가 비어있습니다.",
          errorType: "EMPTY_CART",
          details: "결제 준비 시 장바구니에 상품이 없습니다.",
        },
        { status: 400 },
      );
    }

    // 6. 장바구니 아이템 조회
    const { data: cartItems } = await supabase
      .from("cart_items")
      .select(
        `
        *,
        product:products!fk_cart_items_product_id(id, name, price, discount_price, stock, status),
        variant:product_variants!fk_cart_items_variant_id(id, variant_value, price_adjustment, stock)
      `,
      )
      .eq("cart_id", cart.id);

    if (!cartItems || cartItems.length === 0) {
      logger.error("장바구니 아이템이 없음", {
        cartId: cart.id,
        clerkUserId,
        nodeEnv: process.env.NODE_ENV,
      });
      logger.groupEnd();
      return NextResponse.json(
        { 
          success: false, 
          message: "장바구니가 비어있습니다.",
          errorType: "EMPTY_CART_ITEMS",
          details: "장바구니에 상품 아이템이 없습니다.",
        },
        { status: 400 },
      );
    }

    logger.info("장바구니 아이템 수:", cartItems.length);

    // 7. 서버에서 금액 재계산 (클라이언트 금액 신뢰하지 않음)
    let totalAmount = 0;
    const orderItems: Array<{
      product_id: string;
      variant_id: string | null;
      product_name: string;
      variant_info: string | null;
      quantity: number;
      price: number;
    }> = [];

    for (const item of cartItems) {
      const product = item.product as {
        id: string;
        name: string;
        price: number;
        discount_price: number | null;
        stock: number;
        status: string;
      };
      const variant = item.variant as {
        id: string;
        variant_value: string;
        price_adjustment: number;
        stock: number;
      } | null;

      // 품절 확인
      if (product.status === "sold_out" || product.stock === 0) {
        logger.error("품절 상품 발견:", product.name);
        logger.groupEnd();
        return NextResponse.json(
          {
            success: false,
            message: `${product.name}은(는) 품절된 상품입니다.`,
          },
          { status: 400 },
        );
      }

      // 재고 확인
      const availableStock = variant ? variant.stock : product.stock;
      if (availableStock < item.quantity) {
        logger.error("재고 부족:", {
          product: product.name,
          requested: item.quantity,
          available: availableStock,
        });
        logger.groupEnd();
        return NextResponse.json(
          {
            success: false,
            message: `${product.name}의 재고가 부족합니다. (현재 재고: ${availableStock}개)`,
          },
          { status: 400 },
        );
      }

      // 가격 계산
      const basePrice = product.discount_price ?? product.price;
      const adjustment = variant?.price_adjustment ?? 0;
      const itemPrice = basePrice + adjustment;

      totalAmount += itemPrice * item.quantity;

      orderItems.push({
        product_id: product.id,
        variant_id: variant?.id ?? null,
        product_name: product.name,
        variant_info: variant?.variant_value ?? null,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    // 배송비 계산
    // 결제 테스트 상품(상품 금액이 100원인 경우)은 배송비 제외
    const hasTestProduct = orderItems.some(
      (item) => item.price === 100
    );
    const shippingFee = hasTestProduct ? 0 : totalAmount >= 50000 ? 0 : 3000;
    const subtotal = totalAmount;
    totalAmount += shippingFee;

    logger.info("서버에서 계산한 금액:", {
      subtotal,
      shippingFee,
      totalAmount,
    });

    // 8. 클라이언트 금액과 서버 금액 비교 (경고만, 차단하지는 않음)
    if (clientAmount && Math.abs(clientAmount - totalAmount) > 1) {
      logger.warn("⚠️ 클라이언트 금액과 서버 금액 불일치:", {
        clientAmount,
        serverAmount: totalAmount,
        difference: Math.abs(clientAmount - totalAmount),
      });
    }

    // 9. 주문 생성
    const orderNumber = generateOrderNumber();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        payment_status: "PENDING",
        fulfillment_status: "UNFULFILLED",
        status: "PENDING", // 하위 호환성
        total_amount: totalAmount,
        // 주문자 정보
        orderer_name: ordererName,
        orderer_phone: ordererPhone,
        orderer_email: ordererEmail,
        // 배송 정보
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        shipping_zip_code: shippingZipCode,
        shipping_memo: shippingMemo || null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      logger.error("주문 생성 실패:", orderError);
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "주문 생성에 실패했습니다." },
        { status: 500 },
      );
    }

    logger.info("✅ 주문 생성 완료:", {
      orderId: order.id,
      orderNumber,
    });

    // 10. 주문 아이템 생성
    const orderItemsData = orderItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      variant_info: item.variant_info,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsData);

    if (itemsError) {
      logger.error("주문 아이템 생성 실패:", itemsError);
      // 주문은 생성되었지만 아이템 생성 실패 시 주문 삭제
      await supabase.from("orders").delete().eq("id", order.id);
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "주문 아이템 생성에 실패했습니다." },
        { status: 500 },
      );
    }

    logger.info(`✅ 주문 아이템 생성 완료: ${orderItemsData.length}개`);

    // 11. 장바구니 비우기 (주문 생성 및 주문 아이템 생성이 성공한 후)
    logger.info("[POST /api/payments/toss/prepare] 장바구니 비우기 시작");
    const { error: cartClearError } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id);

    if (cartClearError) {
      logger.error("⚠️ 장바구니 비우기 실패 (주문은 성공):", cartClearError);
      // 장바구니 비우기 실패해도 주문은 성공했으므로 경고만 로그
    } else {
      logger.info("✅ 장바구니 비우기 완료");
    }

    // 12. 주문명 생성 (상품명들 조합)
    const productNames = orderItems
      .slice(0, 3)
      .map((item) => item.product_name)
      .join(", ");
    const orderName =
      orderItems.length > 3
        ? `${productNames} 외 ${orderItems.length - 3}개`
        : productNames;

    logger.info("주문명:", orderName);

    // 13. 응답 반환
    const response = {
      success: true,
      orderId: order.id,
      amount: totalAmount,
      orderName,
      customerName: user.name || "고객",
      customerEmail: user.email || "",
    };

    logger.info("✅ 결제 준비 완료:", {
      orderId: response.orderId,
      amount: response.amount,
      orderName: response.orderName,
    });
    logger.groupEnd();

    return NextResponse.json(response);
  } catch (error) {
    logger.error("결제 준비 중 예외 발생:", error);
    logger.groupEnd();
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "결제 준비 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
