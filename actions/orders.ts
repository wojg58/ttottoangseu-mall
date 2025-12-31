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
  logger.info("주문자 정보:", {
    name: input.ordererName,
    phone: input.ordererPhone,
    email: input.ordererEmail,
  });
  logger.info("배송 정보:", {
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
        product:products!fk_cart_items_product_id(id, name, price, discount_price, stock, status, smartstore_product_id),
        variant:product_variants!fk_cart_items_variant_id(id, variant_value, price_adjustment, stock, smartstore_option_id, smartstore_channel_product_no)
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

      // 재고 확인 (옵션이 있으면 옵션 재고 확인, 없으면 상품 재고 확인)
      if (variant) {
        // 옵션 재고 확인
        const { data: variantData } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("id", variant.id)
          .single();

        if (!variantData || variantData.stock < item.quantity) {
          logger.groupEnd();
          return {
            success: false,
            message: `${product.name} (${variant.variant_value})의 재고가 부족합니다. (현재 재고: ${variantData?.stock || 0}개)`,
          };
        }
      } else {
        // 상품 재고 확인
        if (product.stock < item.quantity) {
          logger.groupEnd();
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

    // 재고 차감 (옵션이 있으면 옵션만, 없으면 상품만)
    // 옵션이 있는 상품의 경우 총 재고 업데이트를 위해 추적
    const productsToUpdateStock = new Set<string>();

    for (const item of cartItems) {
      const product = item.product as { id: string; stock: number };
      const variant = item.variant as { id: string; stock: number } | null;

      if (variant) {
        // 옵션이 있는 경우: 옵션 재고만 차감
        await supabase
          .from("product_variants")
          .update({ stock: variant.stock - item.quantity })
          .eq("id", variant.id);
        logger.info(`[createOrder] 옵션 재고 차감: Variant ID ${variant.id}, 기존 ${variant.stock} -> ${variant.stock - item.quantity}`);
        
        // 옵션이 있는 상품은 총 재고도 업데이트 필요
        productsToUpdateStock.add(product.id);
      } else {
        // 옵션이 없는 경우: 상품 재고만 차감
        await supabase
          .from("products")
          .update({ stock: product.stock - item.quantity })
          .eq("id", product.id);
        logger.info(`[createOrder] 상품 재고 차감: Product ID ${product.id}, 기존 ${product.stock} -> ${product.stock - item.quantity}`);
      }
    }

    // 옵션이 있는 상품의 총 재고 업데이트 (모든 옵션 재고 합산)
    if (productsToUpdateStock.size > 0) {
      logger.info(`[createOrder] 옵션이 있는 상품 ${productsToUpdateStock.size}개의 총 재고 업데이트 시작`);
      
      for (const productId of productsToUpdateStock) {
        // 해당 상품의 모든 옵션 재고 합산
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("product_id", productId)
          .is("deleted_at", null);

        if (variantsError) {
          logger.error(`[createOrder] 옵션 재고 조회 실패 (Product ID: ${productId}):`, variantsError);
          continue;
        }

        if (variants && variants.length > 0) {
          const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
          
          const { error: updateError } = await supabase
            .from("products")
            .update({ stock: totalStock })
            .eq("id", productId);

          if (updateError) {
            logger.error(`[createOrder] 총 재고 업데이트 실패 (Product ID: ${productId}):`, updateError);
          } else {
            logger.info(`[createOrder] 총 재고 업데이트 완료: Product ID ${productId} -> ${totalStock}개`);
          }
        }
      }
    }

    // 네이버 동기화 큐 적재 (옵션 단위, 재고 차감 후)
    logger.info("[createOrder] 네이버 동기화 큐 적재 시작 (옵션 단위)");
    try {
      const { data: orderItems, error: orderItemsError } = await supabase
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
        .eq("order_id", order.id);

      if (orderItemsError) {
        logger.error("[createOrder] ❌ order_items 조회 실패:", orderItemsError);
      } else {
        logger.info(`[createOrder] order_items 조회 완료: ${orderItems?.length || 0}건`);
        
        if (orderItems && orderItems.length > 0) {
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
              logger.info(
                `[createOrder] 옵션 단위 큐 추가: ${product.id} / variant ${variant.id} → 스마트스토어 옵션 ${variant.smartstore_option_id} (재고: ${variant.stock})`
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
              logger.info(
                `[createOrder] 상품 단위 큐 추가: ${product.id} → 스마트스토어 ${product.smartstore_product_id} (재고: ${product.stock})`
              );
            }
          }

          logger.info(`[createOrder] 네이버 연동 상품 필터링 결과: ${queueData.length}건`);

          if (queueData.length > 0) {
            logger.info("[createOrder] 큐에 추가할 데이터:", queueData);
            const { error: queueError, data: insertedData } = await supabase
              .from('naver_sync_queue')
              .insert(queueData)
              .select();

            if (queueError) {
              logger.error("[createOrder] ❌ 네이버 동기화 큐 적재 실패:", queueError);
            } else {
              logger.info(`[createOrder] ✅ 네이버 동기화 큐 적재 완료: ${queueData.length}건`, insertedData);
            }
          } else {
            logger.info("[createOrder] 네이버 연동 상품 없음 (smartstore_product_id가 없는 상품만 있음)");
          }
        } else {
          logger.warn("[createOrder] order_items가 비어있음");
        }
      }
    } catch (e) {
      logger.error("[createOrder] ❌ 네이버 동기화 큐 적재 실패 (주문은 성공):", e);
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
            logger.info(`[cancelOrder] 옵션 재고 복구: Variant ID ${item.variant_id}, 기존 ${variant.stock} -> ${variant.stock + item.quantity}`);
            
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
            logger.info(`[cancelOrder] 상품 재고 복구: Product ID ${item.product_id}, 기존 ${product.stock} -> ${product.stock + item.quantity}`);
          }
        }
      }
    }

    // 옵션이 있는 상품의 총 재고 업데이트 (모든 옵션 재고 합산)
    if (productsToUpdateStock.size > 0) {
      logger.info(`[cancelOrder] 옵션이 있는 상품 ${productsToUpdateStock.size}개의 총 재고 업데이트 시작`);
      
      for (const productId of productsToUpdateStock) {
        // 해당 상품의 모든 옵션 재고 합산
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("stock")
          .eq("product_id", productId)
          .is("deleted_at", null);

        if (variantsError) {
          logger.error(`[cancelOrder] 옵션 재고 조회 실패 (Product ID: ${productId}):`, variantsError);
          continue;
        }

        if (variants && variants.length > 0) {
          const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
          
          const { error: updateError } = await supabase
            .from("products")
            .update({ stock: totalStock })
            .eq("id", productId);

          if (updateError) {
            logger.error(`[cancelOrder] 총 재고 업데이트 실패 (Product ID: ${productId}):`, updateError);
          } else {
            logger.info(`[cancelOrder] 총 재고 업데이트 완료: Product ID ${productId} -> ${totalStock}개`);
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
