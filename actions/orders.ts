/**
 * @file actions/orders.ts
 * @description 주문 관련 Server Actions
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import type { Order, OrderWithItems } from "@/types/database";

// 현재 사용자의 Supabase user ID 조회
async function getCurrentUserId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  return user?.id ?? null;
}

// 주문번호 생성
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${year}${month}${day}-${random}`;
}

// 주문 생성 입력 타입
export interface CreateOrderInput {
  ordererName: string;
  ordererPhone: string;
  ordererEmail: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingZipCode: string;
  shippingMemo?: string;
  couponId?: string | null;
}

// 주문 생성
export async function createOrder(input: CreateOrderInput): Promise<{
  success: boolean;
  message: string;
  orderId?: string;
  orderNumber?: string;
}> {
  logger.group("[createOrder] 주문 생성");
  logger.log("주문자 정보:", {
    name: input.ordererName,
    phone: input.ordererPhone,
    email: input.ordererEmail,
  });
  logger.log("배송 정보:", {
    name: input.shippingName,
    phone: input.shippingPhone,
    address: input.shippingAddress,
    zipCode: input.shippingZipCode,
    memo: input.shippingMemo,
  });

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.groupEnd();
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    // 장바구니 조회
    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!cart) {
      logger.groupEnd();
      return { success: false, message: "장바구니가 비어있습니다." };
    }

    // 장바구니 아이템 조회
    const { data: cartItems } = await supabase
      .from("cart_items")
      .select(
        `
        *,
        product:products!fk_cart_items_product_id(id, name, price, discount_price, stock, status),
        variant:product_variants!fk_cart_items_variant_id(id, variant_value, price_adjustment)
      `,
      )
      .eq("cart_id", cart.id);

    if (!cartItems || cartItems.length === 0) {
      logger.groupEnd();
      return { success: false, message: "장바구니가 비어있습니다." };
    }

    // 재고 확인 및 총 금액 계산
    let totalAmount = 0;
    const orderItems: {
      product_id: string;
      variant_id: string | null;
      product_name: string;
      variant_info: string | null;
      quantity: number;
      price: number;
    }[] = [];

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
      } | null;

      // 품절 확인
      if (product.status === "sold_out" || product.stock === 0) {
        logger.groupEnd();
        return {
          success: false,
          message: `${product.name}은(는) 품절된 상품입니다.`,
        };
      }

      // 재고 확인
      if (product.stock < item.quantity) {
        logger.groupEnd();
        return {
          success: false,
          message: `${product.name}의 재고가 부족합니다. (현재 재고: ${product.stock}개)`,
        };
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

    // 쿠폰 할인 적용
    let couponDiscount = 0;
    if (input.couponId) {
      const { data: coupon, error: couponError } = await supabase
        .from("coupons")
        .select("*")
        .eq("id", input.couponId)
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (!couponError && coupon) {
        if (new Date(coupon.expires_at) >= new Date()) {
          if (subtotal >= coupon.min_order_amount) {
            if (coupon.discount_type === "fixed") {
              couponDiscount = coupon.discount_amount;
            } else if (coupon.discount_type === "percentage") {
              couponDiscount = (subtotal * coupon.discount_amount) / 100;
              if (coupon.max_discount_amount && couponDiscount > coupon.max_discount_amount) {
                couponDiscount = coupon.max_discount_amount;
              }
            }
            couponDiscount = Math.floor(couponDiscount);
            totalAmount = Math.max(0, totalAmount - couponDiscount);
          }
        }
      }
    }

    // 주문 생성
    const orderNumber = generateOrderNumber();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        order_number: orderNumber,
        status: "pending",
        total_amount: totalAmount,
        shipping_name: input.shippingName,
        shipping_phone: input.shippingPhone,
        shipping_address: input.shippingAddress,
        shipping_zip_code: input.shippingZipCode,
        shipping_memo: input.shippingMemo ?? null,
        coupon_id: input.couponId || null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      logger.error("주문 생성 실패", orderError);
      logger.groupEnd();
      return { success: false, message: "주문 생성에 실패했습니다." };
    }

    // 주문 아이템 생성
    const orderItemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      logger.error("주문 아이템 생성 실패", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      logger.groupEnd();
      return { success: false, message: "주문 생성에 실패했습니다." };
    }

    // 재고 차감
    for (const item of cartItems) {
      const product = item.product as { id: string; stock: number };
      await supabase
        .from("products")
        .update({ stock: product.stock - item.quantity })
        .eq("id", product.id);
    }

    // 장바구니 비우기
    await supabase.from("cart_items").delete().eq("cart_id", cart.id);

    // 쿠폰 사용 처리
    if (input.couponId && couponDiscount > 0) {
      await supabase
        .from("coupons")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
          order_id: order.id,
        })
        .eq("id", input.couponId);
    }

    // 주문 생성 후 장바구니가 비워지므로 장바구니 페이지만 revalidate
    // checkout 페이지는 revalidate하지 않음 (주문 생성 후에도 페이지에 머물 수 있도록)
    revalidatePath("/cart");
    revalidatePath("/mypage/orders");
    // checkout 페이지는 revalidate하지 않음 - 주문 생성 후에도 결제 위젯을 표시하기 위해

    logger.info("주문 생성 완료", orderNumber);
    logger.groupEnd();
    return {
      success: true,
      message: "주문이 생성되었습니다.",
      orderId: order.id,
      orderNumber,
    };
  } catch (error) {
    logger.error("주문 생성 예외", error);
    logger.groupEnd();
    return { success: false, message: "주문 생성에 실패했습니다." };
  }
}

// 간편 결제용 주문 생성 입력 타입
export interface CreateQuickOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
}

// 간편 결제용 주문 생성 (12,200원 고정)
export async function createQuickOrder(
  input: CreateQuickOrderInput,
): Promise<{
  success: boolean;
  message: string;
  orderId?: string;
  orderNumber?: string;
}> {
  logger.group("[createQuickOrder] 간편 주문 생성");
  console.log("[createQuickOrder] 입력 데이터:", input);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.groupEnd();
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    // 주문 생성 (배송 정보는 최소화)
    const orderNumber = generateOrderNumber();
    console.log("[createQuickOrder] 주문번호 생성:", orderNumber);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        order_number: orderNumber,
        status: "pending",
        total_amount: input.amount,
        shipping_name: input.customerName,
        shipping_phone: input.customerPhone,
        shipping_address: "간편 결제 (배송 정보 없음)",
        shipping_zip_code: "",
        shipping_memo: `간편 결제 - 이메일: ${input.customerEmail}`,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      logger.error("간편 주문 생성 실패", orderError);
      console.error("[createQuickOrder] 주문 생성 에러:", orderError);
      logger.groupEnd();
      return { success: false, message: "주문 생성에 실패했습니다." };
    }

    console.log("[createQuickOrder] 주문 생성 성공:", {
      orderId: order.id,
      orderNumber,
    });

    logger.info("간편 주문 생성 완료", orderNumber);
    logger.groupEnd();
    return {
      success: true,
      message: "주문이 생성되었습니다.",
      orderId: order.id,
      orderNumber,
    };
  } catch (error) {
    logger.error("간편 주문 생성 예외", error);
    console.error("[createQuickOrder] 예외 발생:", error);
    logger.groupEnd();
    return { success: false, message: "주문 생성에 실패했습니다." };
  }
}

// 주문 목록 조회
export async function getOrders(): Promise<Order[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("주문 목록 조회 실패", error);
    return [];
  }

  return data as Order[];
}

// 주문 상세 조회
export async function getOrderById(
  orderId: string,
): Promise<OrderWithItems | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error || !order) {
    logger.error("주문 상세 조회 실패", error);
    return null;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  return {
    ...order,
    items: items || [],
  } as OrderWithItems;
}

// 결제 정보 저장
export async function savePaymentInfo(
  orderId: string,
  paymentData: {
    paymentKey: string;
    method: string;
    amount: number;
  },
): Promise<{ success: boolean; message: string }> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (!order) {
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      payment_key: paymentData.paymentKey,
      method: paymentData.method as
        | "card"
        | "virtual_account"
        | "transfer"
        | "mobile"
        | "etc",
      status: "done",
      amount: paymentData.amount,
      approved_at: new Date().toISOString(),
    });

    if (paymentError) {
      logger.error("결제 정보 저장 실패", paymentError);
      return { success: false, message: "결제 정보 저장에 실패했습니다." };
    }

    await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId);

    revalidatePath("/mypage/orders");
    return { success: true, message: "결제가 완료되었습니다." };
  } catch (error) {
    logger.error("결제 처리 예외", error);
    return { success: false, message: "결제 처리에 실패했습니다." };
  }
}

/**
 * 주문 취소
 */
export async function cancelOrder(
  orderId: string,
): Promise<{ success: boolean; message: string }> {
  logger.group("[cancelOrder] 주문 취소");

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.groupEnd();
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (orderError || !order) {
      logger.error("주문 조회 실패", orderError);
      logger.groupEnd();
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    if (order.status === "cancelled") {
      logger.groupEnd();
      return { success: false, message: "이미 취소된 주문입니다." };
    }

    if (order.status === "shipped" || order.status === "delivered") {
      logger.groupEnd();
      return {
        success: false,
        message: "배송 중이거나 배송 완료된 주문은 취소할 수 없습니다.",
      };
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (itemsError) {
      logger.error("주문 아이템 조회 실패", itemsError);
      logger.groupEnd();
      return { success: false, message: "주문 정보 조회에 실패했습니다." };
    }

    // 재고 복구
    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.product_id)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ stock: product.stock + item.quantity })
            .eq("id", item.product_id);
        }
      }
    }

    // 쿠폰 복구
    if (order.coupon_id) {
      await supabase
        .from("coupons")
        .update({
          status: "active",
          used_at: null,
          order_id: null,
        })
        .eq("id", order.coupon_id);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (updateError) {
      logger.error("주문 취소 실패", updateError);
      logger.groupEnd();
      return { success: false, message: "주문 취소에 실패했습니다." };
    }

    revalidatePath("/mypage/orders");
    revalidatePath(`/mypage/orders/${orderId}`);

    logger.info("주문 취소 완료", order.order_number);
    logger.groupEnd();
    return { success: true, message: "주문이 취소되었습니다." };
  } catch (error) {
    logger.error("주문 취소 예외", error);
    logger.groupEnd();
    return { success: false, message: "주문 취소 중 오류가 발생했습니다." };
  }
}
