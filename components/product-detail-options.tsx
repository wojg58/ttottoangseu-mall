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
import { Minus, Plus, ShoppingCart, X, CheckCircle2 } from "lucide-react";
import type { ProductVariant } from "@/types/database";
import ProductVariantSelector from "@/components/product-variant-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addToCart, buyNowAndRedirect, buyNowWithOptionsAndRedirect } from "@/actions/cart";

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { isLoaded, userId, isSignedIn } = useAuth();
  const router = useRouter();

  console.group("🟡 [ProductDetailOptions] 컴포넌트 렌더링");
  console.log("렌더링 시간:", new Date().toISOString());
  console.log("상태:", {
    productId,
    selectedOptionsCount: selectedOptions.length,
    hasVariants: variants && variants.filter((v) => !v.deleted_at).length > 0,
    isSignedIn,
    quantity,
  });
  console.groupEnd();

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
    console.log("[ProductDetailOptions] 장바구니 담기 버튼 클릭:", {
      isLoaded,
      userId,
      isSignedIn,
      hasVariants,
      selectedOptionsCount: selectedOptions.length,
    });

    // Clerk 인증 상태가 아직 로드되지 않았으면 대기
    if (!isLoaded) {
      console.log("[ProductDetailOptions] Clerk 인증 상태 로딩 중...");
      return;
    }

    // 인증 상태가 로드되었는데 userId가 없으면 로그인 필요
    if (!userId) {
      console.log("[ProductDetailOptions] 로그인 필요");
      const currentUrl = window.location.pathname + window.location.search;
      router.push("/sign-in?redirect_url=" + encodeURIComponent(currentUrl));
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
              console.error("[ProductDetailOptions] 장바구니 담기 실패:", {
                option: option.variant.variant_value,
                message: result.message,
              });
              
              // 로그인 관련 에러인 경우 로그인 페이지로 리다이렉트
              if (result.message.includes("로그인이 필요")) {
                alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
                router.push("/sign-in?redirect_url=" + window.location.pathname);
                return;
              }
              
              alert(`${option.variant.variant_value}: ${result.message}`);
              return;
            }
          }
          // 장바구니에 담은 후 선택 옵션 초기화
          setSelectedOptions([]);
          setShowSuccessModal(true);
        } else {
          // 옵션이 없는 상품: 수량만 지정하여 장바구니에 추가
          const result = await addToCart(productId, quantity);
          if (!result.success) {
            console.error("[ProductDetailOptions] 장바구니 담기 실패:", {
              message: result.message,
            });
            
            // 로그인 관련 에러인 경우 로그인 페이지로 리다이렉트
            if (result.message.includes("로그인이 필요")) {
              alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
              router.push("/sign-in?redirect_url=" + window.location.pathname);
              return;
            }
            
            alert(result.message);
            return;
          }
          setShowSuccessModal(true);
        }
        console.log("[ProductDetailOptions] 장바구니 담기 성공");
      } catch (error) {
        console.error("[ProductDetailOptions] 장바구니 담기 실패:", error);
        alert("장바구니 담기에 실패했습니다.");
      }
    });
  };

  const handleBuyNow = async () => {
    console.group("🔵 [ProductDetailOptions] 바로 구매 버튼 클릭");
    console.log("클릭 시간:", new Date().toISOString());
    console.log("상태:", {
      isLoaded,
      userId,
      isSignedIn,
      hasVariants,
      selectedOptionsCount: selectedOptions.length,
      productId,
      quantity,
    });

    // Clerk 인증 상태가 아직 로드되지 않았으면 대기
    if (!isLoaded) {
      console.log("[ProductDetailOptions] Clerk 인증 상태 로딩 중...");
      return;
    }

    // 인증 상태가 로드되었는데 userId가 없으면 로그인 필요
    if (!userId) {
      console.log("[ProductDetailOptions] 로그인 필요");
      const currentUrl = window.location.pathname + window.location.search;
      router.push("/sign-in?redirect_url=" + encodeURIComponent(currentUrl));
      return;
    }

    // 옵션이 있는 상품은 옵션 선택 필수
    if (hasVariants && selectedOptions.length === 0) {
      console.warn("⚠️ 옵션 선택 필요");
      console.groupEnd();
      alert("옵션을 선택해주세요.");
      return;
    }

    console.log("✅ 모든 검증 통과 - 바로 구매 시작:", {
      hasVariants,
      selectedOptions,
      quantity,
    });

    startTransition(async () => {
      try {
        if (hasVariants) {
          // 옵션이 있는 상품: Server Action에서 모든 옵션을 처리하고 리다이렉트
          const options = selectedOptions.map((option) => ({
            variantId: option.variant.id,
            quantity: option.quantity,
          }));
          await buyNowWithOptionsAndRedirect(productId, options);
          // redirect()는 never를 반환하므로 여기 도달하지 않음
        } else {
          // 옵션이 없는 상품: Server Action에서 직접 리다이렉트
          await buyNowAndRedirect(productId, quantity);
          // redirect()는 never를 반환하므로 여기 도달하지 않음
        }
      } catch (error) {
        console.error("[ProductDetailOptions] 바로 구매 실패:", error);
        const errorMessage = error instanceof Error ? error.message : "주문에 실패했습니다.";
        
        // 서버에서 반환한 로그인 관련 에러인 경우 (실제 세션 만료)
        if (errorMessage.includes("로그인이 필요")) {
          console.error("❌ 서버에서 로그인 필요 응답 - 실제 세션 만료");
          alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
          router.push("/sign-in?redirect_url=" + window.location.pathname);
          return;
        }
        
        alert(errorMessage);
      }
    });
  };

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
            !isLoaded ||
            (hasVariants && selectedOptions.length === 0) ||
            isPending ||
            isSoldOut
          }
          variant="outline"
          className="flex-1 h-14 border-2 border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5] rounded-xl text-base font-bold"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          {!isLoaded ? "로딩 중..." : isPending ? "담는 중..." : "장바구니"}
        </Button>
        <Button
          onClick={(e) => {
            console.log("🟢 [ProductDetailOptions] 바로 구매 버튼 클릭 이벤트 발생!");
            console.log("이벤트:", e);
            console.log("현재 상태:", { isLoaded, userId, isSignedIn, hasVariants, selectedOptionsCount: selectedOptions.length });
            handleBuyNow();
          }}
          disabled={
            !isLoaded ||
            (hasVariants && selectedOptions.length === 0) ||
            isPending ||
            isSoldOut
          }
          className="flex-1 h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold"
        >
          {!isLoaded ? "로딩 중..." : isPending ? "처리 중..." : "바로 구매"}
        </Button>
      </div>

      {/* 장바구니 담기 성공 모달 */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-[#ffeef5] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-[#ff6b9d]" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-bold text-[#4a3f48]">
              장바구니에 담았습니다
            </DialogTitle>
            <DialogDescription className="text-center text-[#8b7d84] pt-2">
              {productName}이(가) 장바구니에 담겼습니다!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowSuccessModal(false)}
              className="w-full sm:w-auto border-[#f5d5e3] text-[#4a3f48] hover:bg-[#ffeef5]"
            >
              쇼핑 계속하기
            </Button>
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                router.push("/cart");
              }}
              className="w-full sm:w-auto bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
            >
              장바구니로 가기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

