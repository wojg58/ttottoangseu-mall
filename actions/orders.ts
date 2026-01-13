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

/**
 * 주문의 재고 차감 (결제 성공 시에만 호출)
 * @param orderId 주문 ID
 * @param supabase Supabase 클라이언트
 */
export async function deductOrderStock(
  orderId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ success: boolean; message?: string }> {
  try {
    // 주문 아이템 조회
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select(
        `
        quantity,
        variant_id,
        product_id,
        product:products!fk_order_items_product_id(id, stock),
        variant:product_variants!fk_order_items_variant_id(id, stock, product_id)
      `,
      )
      .eq("order_id", orderId);

    if (itemsError || !orderItems || orderItems.length === 0) {
      logger.error("[deductOrderStock] 주문 아이템 조회 실패", itemsError);
      return { success: false, message: "주문 아이템을 찾을 수 없습니다." };
    }

    // 재고 차감 (옵션이 있으면 옵션만, 없으면 상품만)
    // 옵션이 있는 상품의 경우 총 재고 업데이트를 위해 추적
    const productsToUpdateStock = new Set<string>();

    for (const item of orderItems) {
      const product = item.product as unknown as {
        id: string;
        stock: number;
      } | null;
      const variant = item.variant as unknown as {
        id: string;
        stock: number;
        product_id: string;
      } | null;

      if (!product) {
        logger.warn("[deductOrderStock] 상품을 찾을 수 없음", {
          productId: item.product_id,
        });
        continue;
      }

      if (variant) {
        // 옵션이 있는 경우: 옵션 재고만 차감
        if (variant.stock < item.quantity) {
          logger.error("[deductOrderStock] 재고 부족", {
            variantId: variant.id,
            currentStock: variant.stock,
            requestedQuantity: item.quantity,
          });
          return {
            success: false,
            message: `재고가 부족합니다. (옵션 ID: ${variant.id})`,
          };
        }

        const { error: variantError } = await supabase
          .from("product_variants")
          .update({ stock: variant.stock - item.quantity })
          .eq("id", variant.id);

        if (variantError) {
          logger.error("[deductOrderStock] 옵션 재고 차감 실패", variantError);
          return { success: false, message: "재고 차감에 실패했습니다." };
        }

        // 옵션이 있는 상품은 총 재고도 업데이트 필요
        productsToUpdateStock.add(product.id);
      } else {
        // 옵션이 없는 경우: 상품 재고만 차감
        if (product.stock < item.quantity) {
          logger.error("[deductOrderStock] 재고 부족", {
            productId: product.id,
            currentStock: product.stock,
            requestedQuantity: item.quantity,
          });
          return {
            success: false,
            message: `재고가 부족합니다. (상품 ID: ${product.id})`,
          };
        }

        const { error: productError } = await supabase
          .from("products")
          .update({ stock: product.stock - item.quantity })
          .eq("id", product.id);

        if (productError) {
          logger.error("[deductOrderStock] 상품 재고 차감 실패", productError);
          return { success: false, message: "재고 차감에 실패했습니다." };
        }
      }
    }

    // 옵션이 있는 상품의 총 재고 업데이트 (모든 옵션 재고 합산)
    if (productsToUpdateStock.size > 0) {
      logger.debug("[deductOrderStock] 옵션이 있는 상품 총 재고 업데이트", {
        count: productsToUpdateStock.size,
      });

      for (const productId of productsToUpdateStock) {
        // 해당 상품의 모든 옵션 재고 합산
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("product_id", productId)
          .is("deleted_at", null);

        if (variantsError) {
          logger.error("[deductOrderStock] 옵션 재고 조회 실패", {
            productId,
            error: variantsError,
          });
          continue;
        }

        if (variants && variants.length > 0) {
          const totalStock = variants.reduce(
            (sum, v) => sum + (v.stock || 0),
            0,
          );

          const { error: updateError } = await supabase
            .from("products")
            .update({ stock: totalStock })
            .eq("id", productId);

          if (updateError) {
            logger.error("[deductOrderStock] 총 재고 업데이트 실패", {
              productId,
              error: updateError,
            });
          }
        }
      }
    }

    return { success: true };
  } catch (error) {
    logger.error("[deductOrderStock] 예외 발생", error);
    return { success: false, message: "재고 차감 중 오류가 발생했습니다." };
  }
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
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.debug("[createOrder] 사용자 미인증");
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
      logger.debug("[createOrder] 장바구니 없음");
      return { success: false, message: "장바구니가 비어있습니다." };
    }

    // 장바구니 아이템 조회
    const { data: cartItems } = await supabase
      .from("cart_items")
      .select(
        `
        *,
        product:products!fk_cart_items_product_id(id, name, price, discount_price, stock, status, smartstore_product_id),
        variant:product_variants!fk_cart_items_variant_id(id, variant_value, price_adjustment, stock, smartstore_option_id, smartstore_channel_product_no)
      `,
      )
      .eq("cart_id", cart.id);

    if (!cartItems || cartItems.length === 0) {
      logger.debug("[createOrder] 장바구니 아이템 없음");
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
        logger.warn("[createOrder] 품절 상품", { productName: product.name });
        return {
          success: false,
          message: `${product.name}은(는) 품절된 상품입니다.`,
        };
      }

      // 재고 확인 (옵션이 있으면 옵션 재고 확인, 없으면 상품 재고 확인)
      if (variant) {
        // 옵션 재고 확인
        const { data: variantData } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("id", variant.id)
          .single();

        if (!variantData || variantData.stock < item.quantity) {
          logger.warn("[createOrder] 재고 부족", {
            productName: product.name,
            variantValue: variant.variant_value,
            availableStock: variantData?.stock || 0,
            requestedQuantity: item.quantity,
          });
          return {
            success: false,
            message: `${product.name} (${
              variant.variant_value
            })의 재고가 부족합니다. (현재 재고: ${variantData?.stock || 0}개)`,
          };
        }
      } else {
        // 상품 재고 확인
        if (product.stock < item.quantity) {
          logger.warn("[createOrder] 재고 부족", {
            productName: product.name,
            availableStock: product.stock,
            requestedQuantity: item.quantity,
          });
          return {
            success: false,
            message: `${product.name}의 재고가 부족합니다. (현재 재고: ${product.stock}개)`,
          };
        }
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
              if (
                coupon.max_discount_amount &&
                couponDiscount > coupon.max_discount_amount
              ) {
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
        payment_status: "PENDING",
        fulfillment_status: "UNFULFILLED",
        status: "PENDING", // 하위 호환성
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
      logger.error("[createOrder] 주문 생성 실패", orderError);
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
      logger.error("[createOrder] 주문 아이템 생성 실패", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      return { success: false, message: "주문 생성에 실패했습니다." };
    }

    // 네이버 동기화 큐 적재 (옵션 단위, 주문 생성 후)
    try {
      const { data: orderItems, error: orderItemsError } = await supabase
        .from("order_items")
        .select(
          `
          quantity,
          variant_id,
          product:products(id, smartstore_product_id, stock),
          variant:product_variants(
            id,
            stock,
            smartstore_option_id,
            smartstore_channel_product_no
          )
        `,
        )
        .eq("order_id", order.id);

      if (orderItemsError) {
        logger.error("[createOrder] order_items 조회 실패", orderItemsError);
      } else if (orderItems && orderItems.length > 0) {
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
          const product = item.product as unknown as {
            id: string;
            smartstore_product_id: string | null;
            stock: number;
          } | null;
          const variant = item.variant as unknown as {
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
          if (
            variant &&
            variant.smartstore_option_id &&
            variant.smartstore_channel_product_no
          ) {
            queueData.push({
              product_id: product.id,
              variant_id: variant.id,
              smartstore_id: variant.smartstore_channel_product_no.toString(),
              smartstore_option_id: variant.smartstore_option_id,
              target_stock: variant.stock,
              status: "pending",
            });
          } else {
            // 옵션이 없거나 매핑이 없는 경우 → 상품 단위 동기화
            queueData.push({
              product_id: product.id,
              variant_id: null,
              smartstore_id: product.smartstore_product_id,
              smartstore_option_id: null,
              target_stock: product.stock,
              status: "pending",
            });
          }
        }

        if (queueData.length > 0) {
          logger.debug("[createOrder] 네이버 동기화 큐 적재", {
            count: queueData.length,
          });
          const { error: queueError } = await supabase
            .from("naver_sync_queue")
            .insert(queueData);

          if (queueError) {
            logger.error(
              "[createOrder] 네이버 동기화 큐 적재 실패",
              queueError,
            );
          }
        }
      }
    } catch (e) {
      logger.error("[createOrder] 네이버 동기화 큐 적재 실패 (주문은 성공)", e);
      // 큐 적재 실패해도 주문은 성공했으므로 계속 진행
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

    logger.info("[createOrder] 주문 생성 완료", { orderNumber });
    return {
      success: true,
      message: "주문이 생성되었습니다.",
      orderId: order.id,
      orderNumber,
    };
  } catch (error) {
    logger.error("[createOrder] 예외 발생", error);
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
export async function createQuickOrder(input: CreateQuickOrderInput): Promise<{
  success: boolean;
  message: string;
  orderId?: string;
  orderNumber?: string;
}> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.debug("[createQuickOrder] 사용자 미인증");
      return { success: false, message: "로그인이 필요합니다." };
    }

    const supabase = await createClient();

    // 주문 생성 (배송 정보는 최소화)
    const orderNumber = generateOrderNumber();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        order_number: orderNumber,
        payment_status: "PENDING",
        fulfillment_status: "UNFULFILLED",
        status: "PENDING", // 하위 호환성
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
      logger.error("[createQuickOrder] 주문 생성 실패", orderError);
      return { success: false, message: "주문 생성에 실패했습니다." };
    }

    logger.info("[createQuickOrder] 주문 생성 완료", { orderNumber });
    return {
      success: true,
      message: "주문이 생성되었습니다.",
      orderId: order.id,
      orderNumber,
    };
  } catch (error) {
    logger.error("[createQuickOrder] 예외 발생", error);
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

    const { normalizePaymentMethod } = await import(
      "@/lib/utils/payment-method"
    );
    const normalizedMethod = normalizePaymentMethod(paymentData.method);

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: orderId,
      payment_key: paymentData.paymentKey,
      method: normalizedMethod, // 한글/영어 → 영어 소문자 변환 (카드/CARD → card)
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
      .update({
        payment_status: "PAID",
        fulfillment_status: "UNFULFILLED",
        status: "PAID", // 하위 호환성
      })
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
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      logger.debug("[cancelOrder] 사용자 미인증");
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
      logger.error("[cancelOrder] 주문 조회 실패", orderError);
      return { success: false, message: "주문을 찾을 수 없습니다." };
    }

    const paymentStatus = order.payment_status || order.status;
    const fulfillmentStatus = order.fulfillment_status;

    if (paymentStatus === "CANCELED" || paymentStatus === "REFUNDED") {
      logger.warn("[cancelOrder] 이미 취소/환불된 주문");
      return { success: false, message: "이미 취소되거나 환불된 주문입니다." };
    }

    // 배송 중이거나 배송 완료된 주문은 취소 불가
    if (fulfillmentStatus === "SHIPPED" || fulfillmentStatus === "DELIVERED") {
      logger.warn("[cancelOrder] 배송 중/완료된 주문 취소 불가");
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
      logger.error("[cancelOrder] 주문 아이템 조회 실패", itemsError);
      return { success: false, message: "주문 정보 조회에 실패했습니다." };
    }

    // 재고 복구
    // 옵션이 있는 상품의 경우 총 재고 업데이트를 위해 추적
    const productsToUpdateStock = new Set<string>();

    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        if (item.variant_id) {
          // 옵션이 있는 경우: 옵션 재고 복구
          const { data: variant } = await supabase
            .from("product_variants")
            .select("stock, product_id")
            .eq("id", item.variant_id)
            .single();

          if (variant) {
            await supabase
              .from("product_variants")
              .update({ stock: variant.stock + item.quantity })
              .eq("id", item.variant_id);

            // 옵션이 있는 상품은 총 재고도 업데이트 필요
            productsToUpdateStock.add(variant.product_id);
          }
        } else {
          // 옵션이 없는 경우: 상품 재고 복구
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
    }

    // 옵션이 있는 상품의 총 재고 업데이트 (모든 옵션 재고 합산)
    if (productsToUpdateStock.size > 0) {
      logger.debug("[cancelOrder] 옵션이 있는 상품 총 재고 업데이트", {
        count: productsToUpdateStock.size,
      });

      for (const productId of productsToUpdateStock) {
        // 해당 상품의 모든 옵션 재고 합산
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("product_id", productId)
          .is("deleted_at", null);

        if (variantsError) {
          logger.error("[cancelOrder] 옵션 재고 조회 실패", {
            productId,
            error: variantsError,
          });
          continue;
        }

        if (variants && variants.length > 0) {
          const totalStock = variants.reduce(
            (sum, v) => sum + (v.stock || 0),
            0,
          );

          const { error: updateError } = await supabase
            .from("products")
            .update({ stock: totalStock })
            .eq("id", productId);

          if (updateError) {
            logger.error("[cancelOrder] 총 재고 업데이트 실패", {
              productId,
              error: updateError,
            });
          }
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
      .update({
        payment_status: "CANCELED",
        fulfillment_status: "CANCELED",
        status: "CANCELED", // 하위 호환성
      })
      .eq("id", orderId);

    if (updateError) {
      logger.error("[cancelOrder] 주문 취소 실패", updateError);
      return { success: false, message: "주문 취소에 실패했습니다." };
    }

    revalidatePath("/mypage/orders");
    revalidatePath(`/mypage/orders/${orderId}`);

    logger.info("[cancelOrder] 주문 취소 완료", {
      orderNumber: order.order_number,
    });
    return { success: true, message: "주문이 취소되었습니다." };
  } catch (error) {
    logger.error("[cancelOrder] 예외 발생", error);
    return { success: false, message: "주문 취소 중 오류가 발생했습니다." };
  }
}
