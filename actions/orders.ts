/**
 * @file actions/orders.ts
 * @description 주문 관련 Server Actions
 *
 * 주요 기능:
 * 1. 주문 생성
 * 2. 주문 조회
 * 3. 주문 상태 변경
 */

"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Order, OrderWithItems, OrderItem } from "@/types/database";

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
  console.group("[createOrder] 주문 생성");
  console.log("배송 정보:", input);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log("로그인 필요");
      console.groupEnd();
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
      console.log("장바구니 없음");
      console.groupEnd();
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
      console.log("장바구니 비어있음");
      console.groupEnd();
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
        console.log("품절 상품:", product.name);
        console.groupEnd();
        return {
          success: false,
          message: `${product.name}은(는) 품절된 상품입니다.`,
        };
      }

      // 재고 확인
      if (product.stock < item.quantity) {
        console.log("재고 부족:", product.name);
        console.groupEnd();
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
      console.log("쿠폰 적용 중:", input.couponId);
      const { data: coupon, error: couponError } = await supabase
        .from("coupons")
        .select("*")
        .eq("id", input.couponId)
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (!couponError && coupon) {
        // 만료 확인
        if (new Date(coupon.expires_at) >= new Date()) {
          // 최소 주문 금액 확인
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
            console.log("쿠폰 할인 적용:", couponDiscount, "원");
          } else {
            console.log("최소 주문 금액 미달");
          }
        } else {
          console.log("쿠폰 만료됨");
        }
      } else {
        console.log("쿠폰 조회 실패:", couponError);
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
      console.error("주문 생성 에러:", orderError);
      console.groupEnd();
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
      console.error("주문 아이템 생성 에러:", itemsError);
      // 주문 롤백 (실패 시)
      await supabase.from("orders").delete().eq("id", order.id);
      console.groupEnd();
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
      console.log("쿠폰 사용 처리:", input.couponId);
      await supabase
        .from("coupons")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
          order_id: order.id,
        })
        .eq("id", input.couponId);
    }

    revalidatePath("/cart");
    revalidatePath("/mypage/orders");

    console.log("주문 생성 성공:", orderNumber);
    console.groupEnd();
    return {
      success: true,
      message: "주문이 생성되었습니다.",
      orderId: order.id,
      orderNumber,
    };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { success: false, message: "주문 생성에 실패했습니다." };
  }
}

// 주문 목록 조회
export async function getOrders(): Promise<Order[]> {
  console.group("[getOrders] 주문 목록 조회");

  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("로그인 필요");
    console.groupEnd();
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("에러:", error);
    console.groupEnd();
    return [];
  }

  console.log("결과:", data?.length, "개 주문");
  console.groupEnd();
  return data as Order[];
}

// 주문 상세 조회
export async function getOrderById(
  orderId: string,
): Promise<OrderWithItems | null> {
  console.group("[getOrderById] 주문 상세 조회");
  console.log("주문 ID:", orderId);

  const userId = await getCurrentUserId();
  if (!userId) {
    console.log("로그인 필요");
    console.groupEnd();
    return null;
  }

  const supabase = await createClient();

  // 주문 조회
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (error || !order) {
    console.error("에러:", error);
    console.groupEnd();
    return null;
  }

  // 주문 아이템 조회
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  console.log("결과:", order.order_number);
  console.groupEnd();

  return {
    ...order,
    items: items || [],
  } as OrderWithItems;
}

// 결제 정보 저장 (TossPayments 결제 후)
export async function savePaymentInfo(
  orderId: string,
  paymentData: {
    paymentKey: string;
    method: string;
    amount: number;
  },
): Promise<{ success: boolean; message: string }> {
  console.group("[savePaymentInfo] 결제 정보 저장");
  console.log("주문 ID:", orderId);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.groupEnd();
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    // 주문 확인
    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (!order) {
      console.log("주문 없음");
      console.groupEnd();
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    // 결제 정보 저장
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
      console.error("결제 정보 저장 에러:", paymentError);
      console.groupEnd();
      return { success: false, message: "결제 정보 저장에 실패했습니다." };
    }

    // 주문 상태 업데이트
    await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId);

    revalidatePath("/mypage/orders");

    console.log("성공");
    console.groupEnd();
    return { success: true, message: "결제가 완료되었습니다." };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return { success: false, message: "결제 처리에 실패했습니다." };
  }
}

/**
 * 주문 취소
 * - pending, confirmed 상태의 주문만 취소 가능
 * - 재고 복구
 * - 쿠폰 복구 (사용된 쿠폰이 있다면)
 */
export async function cancelOrder(
  orderId: string,
): Promise<{ success: boolean; message: string }> {
  console.group("[cancelOrder] 주문 취소 요청");
  console.log("주문 ID:", orderId);

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log("로그인 필요");
      console.groupEnd();
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    // 주문 조회
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (orderError || !order) {
      console.error("주문 조회 에러:", orderError);
      console.groupEnd();
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    // 취소 가능한 상태 확인
    if (order.status === "cancelled") {
      console.log("이미 취소된 주문");
      console.groupEnd();
      return { success: false, message: "이미 취소된 주문입니다." };
    }

    if (order.status === "shipped" || order.status === "delivered") {
      console.log("배송 중이거나 완료된 주문은 취소 불가");
      console.groupEnd();
      return {
        success: false,
        message: "배송 중이거나 배송 완료된 주문은 취소할 수 없습니다.",
      };
    }

    // 주문 아이템 조회
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (itemsError) {
      console.error("주문 아이템 조회 에러:", itemsError);
      console.groupEnd();
      return { success: false, message: "주문 정보 조회에 실패했습니다." };
    }

    // 재고 복구
    if (orderItems && orderItems.length > 0) {
      console.log("재고 복구 중...");
      for (const item of orderItems) {
        // 상품 재고 조회
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
          console.log(
            `재고 복구: ${item.product_name} +${item.quantity}개`,
          );
        }
      }
    }

    // 쿠폰 복구 (사용된 쿠폰이 있다면)
    if (order.coupon_id) {
      console.log("쿠폰 복구 중...", order.coupon_id);
      const { error: couponError } = await supabase
        .from("coupons")
        .update({
          status: "active",
          used_at: null,
          order_id: null,
        })
        .eq("id", order.coupon_id);

      if (couponError) {
        console.error("쿠폰 복구 에러:", couponError);
      } else {
        console.log("쿠폰 복구 완료");
      }
    }

    // 주문 상태를 cancelled로 변경
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (updateError) {
      console.error("주문 취소 에러:", updateError);
      console.groupEnd();
      return { success: false, message: "주문 취소에 실패했습니다." };
    }

    revalidatePath("/mypage/orders");
    revalidatePath(`/mypage/orders/${orderId}`);

    console.log("✅ 주문 취소 완료:", order.order_number);
    console.groupEnd();
    return { success: true, message: "주문이 취소되었습니다." };
  } catch (error) {
    console.error("❌ 주문 취소 중 예외 발생:", error);
    console.groupEnd();
    return { success: false, message: "주문 취소 중 오류가 발생했습니다." };
  }
}
