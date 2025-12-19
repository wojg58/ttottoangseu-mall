/**
 * @file components/product-detail-options.tsx
 * @description 상품 상세 페이지 옵션 선택 및 장바구니 버튼 영역
 *
 * 주요 기능:
 * 1. 옵션 선택 (ProductVariantSelector)
 * 2. 선택된 옵션에 따른 가격 계산
 * 3. 선택된 옵션에 따른 재고 표시
 * 4. 장바구니 담기 버튼
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import type { ProductVariant } from "@/types/database";
import ProductVariantSelector from "@/components/product-variant-selector";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/actions/cart";

interface ProductDetailOptionsProps {
  productId: string;
  productName: string;
  basePrice: number;
  baseStock: number;
  variants: ProductVariant[];
  isSoldOut: boolean;
}

interface SelectedOption {
  variant: ProductVariant;
  quantity: number;
}

export default function ProductDetailOptions({
  productId,
  productName,
  basePrice,
  baseStock,
  variants,
  isSoldOut,
}: ProductDetailOptionsProps) {
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [quantity, setQuantity] = useState(1); // 옵션이 없는 상품의 수량
  const [isPending, startTransition] = useTransition();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  console.log("[ProductDetailOptions] 렌더링:", {
    productId,
    selectedOptionsCount: selectedOptions.length,
    hasVariants: variants && variants.filter((v) => !v.deleted_at).length > 0,
  });

  // 옵션이 있고 필수인 경우 선택 여부 확인
  const hasVariants = variants && variants.filter((v) => !v.deleted_at).length > 0;

  const handleVariantChange = (variantId: string | null, variant: ProductVariant | null) => {
    if (!variantId || !variant) return;

    console.log("[ProductDetailOptions] 옵션 선택:", { variantId, variant: variant.variant_value });

    // 이미 선택된 옵션인지 확인
    const existingIndex = selectedOptions.findIndex((opt) => opt.variant.id === variantId);

    if (existingIndex === -1) {
      // 새 옵션 추가
      setSelectedOptions((prev) => [
        ...prev,
        {
          variant,
          quantity: 1,
        },
      ]);
    }
  };

  const handleRemoveOption = (variantId: string) => {
    setSelectedOptions((prev) => prev.filter((opt) => opt.variant.id !== variantId));
    console.log("[ProductDetailOptions] 옵션 제거:", variantId);
  };

  const handleQuantityChange = (variantId: string, delta: number) => {
    setSelectedOptions((prev) =>
      prev.map((opt) => {
        if (opt.variant.id === variantId) {
          const newQuantity = opt.quantity + delta;
          const maxStock = opt.variant.stock;
          if (newQuantity >= 1 && newQuantity <= maxStock) {
            return { ...opt, quantity: newQuantity };
          }
        }
        return opt;
      }),
    );
    console.log("[ProductDetailOptions] 수량 변경:", variantId, delta);
  };

  // 총 수량과 총 금액 계산
  const totalQuantity = selectedOptions.reduce((sum, opt) => sum + opt.quantity, 0);
  const totalPrice = selectedOptions.reduce(
    (sum, opt) => sum + (basePrice + (opt.variant.price_adjustment || 0)) * opt.quantity,
    0,
  );

  const handleAddToCart = async () => {
    if (!isSignedIn) {
      console.log("[ProductDetailOptions] 로그인 필요");
      router.push("/sign-in?redirect_url=" + window.location.pathname);
      return;
    }

    // 옵션이 있는 상품은 옵션 선택 필수
    if (hasVariants && selectedOptions.length === 0) {
      alert("옵션을 선택해주세요.");
      return;
    }

    console.log("[ProductDetailOptions] 장바구니 담기 시작:", {
      hasVariants,
      selectedOptions,
      quantity,
    });

    startTransition(async () => {
      try {
        if (hasVariants) {
          // 옵션이 있는 상품: 모든 옵션을 순차적으로 장바구니에 추가
          for (const option of selectedOptions) {
            const result = await addToCart(
              productId,
              option.quantity,
              option.variant.id,
            );
            if (!result.success) {
              alert(`${option.variant.variant_value}: ${result.message}`);
              return;
            }
          }
          alert(`${productName}이(가) 장바구니에 담겼습니다!`);
          // 장바구니에 담은 후 선택 옵션 초기화
          setSelectedOptions([]);
        } else {
          // 옵션이 없는 상품: 수량만 지정하여 장바구니에 추가
          const result = await addToCart(productId, quantity);
          if (!result.success) {
            alert(result.message);
            return;
          }
          alert(`${productName}이(가) 장바구니에 담겼습니다!`);
        }
        console.log("[ProductDetailOptions] 장바구니 담기 성공");
      } catch (error) {
        console.error("[ProductDetailOptions] 장바구니 담기 실패:", error);
        alert("장바구니 담기에 실패했습니다.");
      }
    });
  };

  const handleBuyNow = async () => {
    if (!isSignedIn) {
      console.log("[ProductDetailOptions] 로그인 필요");
      router.push("/sign-in?redirect_url=" + window.location.pathname);
      return;
    }

    console.log("[ProductDetailOptions] 바로 구매:", {
      hasVariants,
      selectedOptions,
      quantity,
    });

    startTransition(async () => {
      try {
        if (hasVariants && selectedOptions.length > 0) {
          // 옵션이 있고 선택된 경우: 모든 옵션을 순차적으로 장바구니에 추가
          for (const option of selectedOptions) {
            const result = await addToCart(
              productId,
              option.quantity,
              option.variant.id,
            );
            if (!result.success) {
              alert(`${option.variant.variant_value}: ${result.message}`);
              return;
            }
          }
        } else {
          // 옵션이 없거나 옵션이 있어도 선택하지 않은 경우: 수량만 지정하여 장바구니에 추가
          const result = await addToCart(productId, quantity);
          if (!result.success) {
            alert(result.message);
            return;
          }
        }
        router.push("/checkout");
      } catch (error) {
        console.error("[ProductDetailOptions] 바로 구매 실패:", error);
        alert("주문에 실패했습니다.");
      }
    });
  };

  const isLoading = isPending;

  return (
    <div className="space-y-6">
      {/* 옵션 선택 */}
      {hasVariants && (
        <div className="mb-6">
          <ProductVariantSelector
            variants={variants}
            basePrice={basePrice}
            onVariantChange={handleVariantChange}
            required={false}
          />
        </div>
      )}

      {/* 재고 표시 (옵션이 없는 상품의 경우) */}
      {!hasVariants && baseStock === 1 && !isSoldOut && (
        <div className="mb-6">
          <p className="text-sm text-[#8b7d84]">
            <span className="text-orange-500">
              🔥 1개 남음 - 품절 임박!
            </span>
          </p>
        </div>
      )}

      {/* 수량 선택 (옵션이 없거나 옵션이 있어도 선택하지 않은 경우) */}
      {(!hasVariants || (hasVariants && selectedOptions.length === 0)) && (
        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm font-bold text-[#4a3f48]">수량</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
              disabled={quantity <= 1 || isSoldOut}
              className="w-8 h-8 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center text-lg font-bold text-[#4a3f48]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                setQuantity((prev) => Math.min(baseStock, prev + 1))
              }
              disabled={quantity >= baseStock || isSoldOut}
              className="w-8 h-8 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <span className="ml-auto text-lg font-bold text-[#4a3f48]">
            {(basePrice * quantity).toLocaleString("ko-KR")}원
          </span>
        </div>
      )}

      {/* 선택한 옵션 목록 */}
      {selectedOptions.length > 0 && (
        <div className="space-y-3 mb-6">
          {selectedOptions.map((option) => {
            const optionPrice = basePrice + (option.variant.price_adjustment || 0);
            const optionTotal = optionPrice * option.quantity;
            const optionStock = option.variant.stock;
            const isOptionLowStock = optionStock === 1 && optionStock > 0;

            return (
              <div
                key={option.variant.id}
                className="flex items-center justify-between p-3 border border-[#f5d5e3] rounded-lg bg-white"
              >
                <div className="flex-1">
                  <p className="text-sm text-[#4a3f48] font-medium">
                    {option.variant.variant_value}
                  </p>
                  {/* 옵션별 재고 표시 (1개일 때만) */}
                  {isOptionLowStock && (
                    <p className="text-xs text-orange-500 mt-1">
                      🔥 1개 남음 - 품절 임박!
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {/* 수량 조절 */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(option.variant.id, -1)}
                      disabled={option.quantity <= 1}
                      className="w-8 h-8 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-sm font-bold text-[#4a3f48]">
                      {option.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(option.variant.id, 1)}
                      disabled={option.quantity >= option.variant.stock}
                      className="w-8 h-8 rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {/* 금액 */}
                  <p className="text-sm font-bold text-[#4a3f48] w-24 text-right">
                    {optionTotal.toLocaleString("ko-KR")}원
                  </p>
                  {/* 삭제 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(option.variant.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#8b7d84] hover:bg-[#ffeef5] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* 총계 */}
          <div className="flex items-center justify-between p-4 bg-[#ffeef5] rounded-lg border border-[#f5d5e3]">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#8b7d84]">총 상품 금액</span>
              <span className="text-xs text-[#8b7d84]">?</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-[#4a3f48]">
                총 수량 {totalQuantity}개
              </span>
              <span className="text-base font-bold text-[#ff6b9d]">
                {totalPrice.toLocaleString("ko-KR")}원
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 장바구니/구매 버튼 */}
      <div className="flex gap-3">
        <Button
          onClick={handleAddToCart}
          disabled={
            (hasVariants && selectedOptions.length === 0) ||
            isLoading ||
            isSoldOut
          }
          variant="outline"
          className="flex-1 h-14 border-2 border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5] rounded-xl text-base font-bold"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          {isLoading ? "담는 중..." : "장바구니"}
        </Button>
        <Button
          onClick={handleBuyNow}
          disabled={isLoading || isSoldOut}
          className="flex-1 h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold"
        >
          {isLoading ? "처리 중..." : "바로 구매"}
        </Button>
      </div>
    </div>
  );
}

