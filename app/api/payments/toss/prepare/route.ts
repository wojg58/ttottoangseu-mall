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
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

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
        { status: 401 }
      );
    }

    logger.info("✅ 사용자 인증 완료:", clerkUserId);

    // 2. 클라이언트에서 전달된 금액 (검증용, 신뢰하지 않음)
    const body = await request.json();
    const clientAmount = body.amount as number | undefined;

    logger.info("클라이언트에서 전달된 금액:", clientAmount);

    // 3. Supabase 클라이언트 생성
    const supabase = await createClient();

    // 4. 사용자 ID 조회
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email")
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
      logger.error("장바구니가 비어있음");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "장바구니가 비어있습니다." },
        { status: 400 }
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
      `
      )
      .eq("cart_id", cart.id);

    if (!cartItems || cartItems.length === 0) {
      logger.error("장바구니 아이템이 없음");
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "장바구니가 비어있습니다." },
        { status: 400 }
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
          { success: false, message: `${product.name}은(는) 품절된 상품입니다.` },
          { status: 400 }
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
          { status: 400 }
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
    const shippingFee = totalAmount >= 50000 ? 0 : 3000;
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
        status: "pending",
        total_amount: totalAmount,
        // 주문자 정보는 기본값으로 설정 (나중에 업데이트 가능)
        shipping_name: user.name || "미입력",
        shipping_phone: "",
        shipping_address: "",
        shipping_zip_code: "",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      logger.error("주문 생성 실패:", orderError);
      logger.groupEnd();
      return NextResponse.json(
        { success: false, message: "주문 생성에 실패했습니다." },
        { status: 500 }
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
        { status: 500 }
      );
    }

    logger.info("✅ 주문 아이템 생성 완료:", orderItemsData.length, "개");

    // 11. 주문명 생성 (상품명들 조합)
    const productNames = orderItems
      .slice(0, 3)
      .map((item) => item.product_name)
      .join(", ");
    const orderName =
      orderItems.length > 3
        ? `${productNames} 외 ${orderItems.length - 3}개`
        : productNames;

    logger.info("주문명:", orderName);

    // 12. 응답 반환
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
      { status: 500 }
    );
  }
}

