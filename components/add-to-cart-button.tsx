/**
 * @file components/add-to-cart-button.tsx
 * @description 장바구니 담기 버튼 컴포넌트
 *
 * 주요 기능:
 * 1. 수량 선택
 * 2. 장바구니 담기
 * 3. 바로 구매
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/actions/cart";

interface AddToCartButtonProps {
  productId: string;
  productName: string;
  price: number;
  stock: number;
  isSoldOut: boolean;
  variantId?: string;
}

export default function AddToCartButton({
  productId,
  productName,
  price,
  stock,
  isSoldOut,
  variantId,
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  console.log("[AddToCartButton] 렌더링:", {
    productId,
    productName,
    isSoldOut,
  });

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= stock) {
      setQuantity(newQuantity);
      console.log("[AddToCartButton] 수량 변경:", newQuantity);
    }
  };

  const handleAddToCart = async () => {
    if (!isSignedIn) {
      console.log("[AddToCartButton] 로그인 필요");
      router.push("/sign-in?redirect_url=" + window.location.pathname);
      return;
    }

    console.log("[AddToCartButton] 장바구니 담기 시작:", {
      productId,
      quantity,
      variantId,
    });

    startTransition(async () => {
      const result = await addToCart(productId, quantity, variantId);
      if (result.success) {
        alert(`${productName}이(가) 장바구니에 담겼습니다!`);
        console.log("[AddToCartButton] 장바구니 담기 성공");
      } else {
        alert(result.message);
        console.error("[AddToCartButton] 장바구니 담기 실패:", result.message);
      }
    });
  };

  const handleBuyNow = async () => {
    if (!isSignedIn) {
      console.log("[AddToCartButton] 로그인 필요");
      router.push("/sign-in?redirect_url=" + window.location.pathname);
      return;
    }

    console.log("[AddToCartButton] 바로 구매:", {
      productId,
      quantity,
      variantId,
    });

    startTransition(async () => {
      const result = await addToCart(productId, quantity, variantId);
      if (result.success) {
        router.push("/checkout");
      } else {
        alert(result.message);
      }
    });
  };

  const isLoading = isPending;

  // 총 금액 계산
  const totalPrice = price * quantity;

  return (
    <div className="space-y-4">
      {/* 수량 선택 */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-bold text-[#4a3f48]">수량</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleQuantityChange(-1)}
            disabled={quantity <= 1 || isSoldOut}
            className="w-8 h-8 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-12 text-center text-lg font-bold text-[#4a3f48]">
            {quantity}
          </span>
          <button
            onClick={() => handleQuantityChange(1)}
            disabled={quantity >= stock || isSoldOut}
            className="w-8 h-8 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <span className="ml-auto text-lg font-bold text-[#4a3f48]">
          {totalPrice.toLocaleString("ko-KR")}원
        </span>
      </div>

      {/* 버튼들 */}
      <div className="flex gap-3">
        <Button
          onClick={handleAddToCart}
          disabled={isSoldOut || isLoading}
          variant="outline"
          className="flex-1 h-14 border-2 border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5] rounded-xl text-base font-bold"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          {isLoading ? "담는 중..." : "장바구니"}
        </Button>
        <Button
          onClick={handleBuyNow}
          disabled={isSoldOut || isLoading}
          className="flex-1 h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold"
        >
          {isSoldOut ? "품절" : "바로 구매"}
        </Button>
      </div>
    </div>
  );
}
