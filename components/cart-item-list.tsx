/**
 * @file components/cart-item-list.tsx
 * @description 장바구니 아이템 목록 컴포넌트
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import {
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
} from "@/actions/cart";
import type { CartItemWithProduct } from "@/types/database";
import { Button } from "@/components/ui/button";

interface CartItemListProps {
  items: CartItemWithProduct[];
}

export default function CartItemList({ items }: CartItemListProps) {
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    console.log("[CartItemList] 수량 변경:", itemId, newQuantity);
    startTransition(async () => {
      const result = await updateCartItemQuantity(itemId, newQuantity);
      if (!result.success) {
        alert(result.message);
      }
    });
  };

  const handleRemove = (itemId: string) => {
    console.log("[CartItemList] 아이템 삭제:", itemId);
    startTransition(async () => {
      const result = await removeFromCart(itemId);
      if (!result.success) {
        alert(result.message);
      }
    });
  };

  const handleClearCart = () => {
    if (!confirm("장바구니를 비우시겠습니까?")) return;
    console.log("[CartItemList] 장바구니 비우기");
    startTransition(async () => {
      const result = await clearCart();
      if (!result.success) {
        alert(result.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-4 border-b border-[#f5d5e3]">
        <span className="text-sm text-[#8b7d84]">총 {items.length}개 상품</span>
        <button
          onClick={handleClearCart}
          disabled={isPending}
          className="text-sm text-[#8b7d84] hover:text-[#ff6b9d] transition-colors disabled:opacity-50"
        >
          전체 삭제
        </button>
      </div>

      {/* 아이템 목록 */}
      <div className="space-y-4">
        {items.map((item) => {
          const isSoldOut =
            item.product.status === "sold_out" || item.product.stock === 0;
          const displayPrice = item.price;

          return (
            <div
              key={item.id}
              className={`flex gap-4 p-4 bg-white rounded-xl shadow-sm ${
                isSoldOut ? "opacity-60" : ""
              }`}
            >
              {/* 상품 이미지 */}
              <Link
                href={`/products/${item.product.slug}`}
                className="shrink-0"
              >
                <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-[#f5f5f5] p-2">
                  <Image
                    src={
                      item.primary_image?.image_url ||
                      "https://placehold.co/200x200/fad2e6/333333?text=No+Image"
                    }
                    alt={item.product.name}
                    fill
                    className="object-contain"
                    sizes="96px"
                  />
                  {isSoldOut && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        품절
                      </span>
                    </div>
                  )}
                </div>
              </Link>

              {/* 상품 정보 */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.product.slug}`}
                  className="text-sm text-[#4a3f48] font-medium line-clamp-2 hover:text-[#ff6b9d] transition-colors"
                >
                  {item.product.name}
                </Link>

                {/* 옵션 정보 */}
                {item.variant && (
                  <p className="text-xs text-[#8b7d84] mt-1">
                    옵션: {item.variant.variant_value}
                  </p>
                )}

                {/* 가격 */}
                <p className="text-base font-bold text-[#4a3f48] mt-2">
                  {mounted
                    ? `${(displayPrice * item.quantity).toLocaleString(
                        "ko-KR",
                      )}원`
                    : `${(displayPrice * item.quantity)
                        .toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`}
                </p>

                {/* 수량 조절 */}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleQuantityChange(item.id, item.quantity - 1)
                      }
                      disabled={isPending || item.quantity <= 1 || isSoldOut}
                      className="w-7 h-7 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-[#4a3f48]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        handleQuantityChange(item.id, item.quantity + 1)
                      }
                      disabled={
                        isPending ||
                        item.quantity >= item.product.stock ||
                        isSoldOut
                      }
                      className="w-7 h-7 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={isPending}
                    className="p-2 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
