/**
 * @file lib/coupon-utils.ts
 * @description 쿠폰 관련 유틸리티 함수 (클라이언트/서버 공통)
 */

import type { Coupon } from "@/actions/coupons";

/**
 * 쿠폰 할인 금액 계산
 */
export function calculateCouponDiscount(
  coupon: Coupon | null,
  subtotal: number,
): number {
  if (!coupon || coupon.status !== "active") {
    return 0;
  }

  // 만료 확인
  if (new Date(coupon.expires_at) < new Date()) {
    return 0;
  }

  // 최소 주문 금액 확인
  if (subtotal < coupon.min_order_amount) {
    return 0;
  }

  let discount = 0;

  if (coupon.discount_type === "fixed") {
    // 고정 금액 할인
    discount = coupon.discount_amount;
  } else if (coupon.discount_type === "percentage") {
    // 퍼센트 할인
    discount = (subtotal * coupon.discount_amount) / 100;
    // 최대 할인 금액 제한
    if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
      discount = coupon.max_discount_amount;
    }
  }

  return Math.floor(discount);
}

