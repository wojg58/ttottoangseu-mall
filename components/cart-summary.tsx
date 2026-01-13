/**
 * @file components/cart-summary.tsx
 * @description 장바구니 주문 요약 컴포넌트
 */

"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import logger from "@/lib/logger-client";

interface CartSummaryProps {
  subtotal: number;
  shippingFee: number;
  total: number;
  itemCount: number;
}

export default function CartSummary({
  subtotal,
  shippingFee,
  total,
  itemCount,
}: CartSummaryProps) {
  const freeShippingThreshold = 50000;
  const amountToFreeShipping = freeShippingThreshold - subtotal;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
      <h2 className="text-lg font-bold text-[#4a3f48] mb-6">주문 요약</h2>

      {/* 무료배송 안내 */}
      {amountToFreeShipping > 0 && (
        <div className="bg-[#ffeef5] rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-[#ff6b9d]">
            <Truck className="w-5 h-5" />
            <span className="text-sm font-medium">
              {amountToFreeShipping.toLocaleString("ko-KR")}원 더 담으면 무료배송!
            </span>
          </div>
          <div className="mt-2 h-2 bg-[#fad2e6] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#ff6b9d] rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (subtotal / freeShippingThreshold) * 100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 금액 정보 */}
      <div className="space-y-3 pb-4 border-b border-[#f5d5e3]">
        <div className="flex justify-between text-sm">
          <span className="text-[#8b7d84]">상품 금액 ({itemCount}개)</span>
          <span className="text-[#4a3f48]">{subtotal.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8b7d84]">배송비</span>
          <span className="text-[#4a3f48]">
            {shippingFee === 0 ? (
              <span className="text-[#ff6b9d]">무료</span>
            ) : (
              `${shippingFee.toLocaleString("ko-KR")}원`
            )}
          </span>
        </div>
      </div>

      {/* 총 금액 */}
      <div className="flex justify-between items-center py-4">
        <span className="text-base font-bold text-[#4a3f48]">총 결제 금액</span>
        <span className="text-xl font-bold text-[#ff6b9d]">
          {total.toLocaleString("ko-KR")}원
        </span>
      </div>

      {/* 결제 버튼 */}
      <Link href="/checkout" className="block">
        <Button 
          className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold"
        >
          {total.toLocaleString("ko-KR")}원 주문하기
        </Button>
      </Link>

      {/* 계속 쇼핑하기 */}
      <Link
        href="/products"
        className="block text-center text-sm text-[#8b7d84] hover:text-[#ff6b9d] mt-4 transition-colors"
      >
        계속 쇼핑하기
      </Link>
    </div>
  );
}
