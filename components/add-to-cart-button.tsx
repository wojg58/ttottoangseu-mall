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
import { Minus, Plus, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addToCart, buyNowAndRedirect } from "@/actions/cart";
import logger from "@/lib/logger-client";

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { isLoaded, userId, isSignedIn } = useAuth();
  const router = useRouter();

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= stock) {
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = async () => {
    // Clerk 인증 상태가 아직 로드되지 않았으면 대기
    if (!isLoaded) {
      logger.debug("[AddToCartButton] Clerk 인증 상태 로딩 중");
      return;
    }

    // 인증 상태가 로드되었는데 userId가 없으면 로그인 필요
    if (!userId) {
      logger.debug("[AddToCartButton] 로그인 필요");
      const currentUrl = window.location.pathname + window.location.search;
      router.push("/sign-in?redirect_url=" + encodeURIComponent(currentUrl));
      return;
    }

    startTransition(async () => {
      const result = await addToCart(productId, quantity, variantId);
      if (result.success) {
        logger.debug("[AddToCartButton] 장바구니 담기 성공");
        setShowSuccessModal(true);
      } else {
        logger.error("[AddToCartButton] 장바구니 담기 실패", {
          message: result.message,
        });

        // 서버에서 반환한 로그인 관련 에러인 경우 (실제 세션 만료)
        if (result.message.includes("로그인이 필요")) {
          logger.warn("[AddToCartButton] 세션 만료");
          alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
          router.push("/sign-in?redirect_url=" + window.location.pathname);
          return;
        }

        alert(result.message);
      }
    });
  };

  const handleBuyNow = async () => {
    // Clerk 인증 상태가 아직 로드되지 않았으면 대기
    if (!isLoaded) {
      logger.warn("[AddToCartButton] Clerk 인증 상태 로딩 중");
      return;
    }

    // 인증 상태가 로드되었는데 userId가 없으면 로그인 필요
    if (!userId) {
      logger.warn("[AddToCartButton] 로그인 필요");
      const currentUrl = window.location.pathname + window.location.search;
      router.push("/sign-in?redirect_url=" + encodeURIComponent(currentUrl));
      return;
    }

    startTransition(async () => {
      try {
        const result = await buyNowAndRedirect(productId, quantity, variantId);
        
        if (result.success) {
          logger.debug("[AddToCartButton] 바로 구매 성공");
          // 장바구니 DB 반영을 위해 잠시 대기 (바로구매 플래그 포함)
          await new Promise((resolve) => setTimeout(resolve, 800));
          // 바로구매 플래그를 쿼리 파라미터로 전달
          router.push("/checkout?buyNow=true");
          return;
        } else {
          logger.warn("[AddToCartButton] 장바구니 추가 실패", {
            message: result.message,
          });
          alert(result.message || "장바구니 추가에 실패했습니다.");
          return;
        }
      } catch (error: any) {
        // Next.js의 redirect()는 NEXT_REDIRECT 에러를 throw합니다. 이건 정상 동작이므로 다시 throw
        // redirect 에러는 message나 digest 속성에 NEXT_REDIRECT가 포함됨
        if (
          error &&
          (error.message === "NEXT_REDIRECT" ||
            error.message?.includes("NEXT_REDIRECT") ||
            error.digest?.includes("NEXT_REDIRECT"))
        ) {
          // 리다이렉트 에러는 조용히 다시 throw (로그나 알림 없이)
          throw error;
        }

        // 실제 에러인 경우에만 로그 및 알림 표시
        logger.error("[AddToCartButton] 바로 구매 실패", error);

        const errorMessage =
          error instanceof Error ? error.message : "주문에 실패했습니다.";

        // 서버에서 반환한 로그인 관련 에러인 경우 (실제 세션 만료)
        if (errorMessage.includes("로그인이 필요")) {
          logger.warn("[AddToCartButton] 세션 만료");
          alert("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
          router.push("/sign-in?redirect_url=" + window.location.pathname);
          return;
        }

        alert(errorMessage);
      }
    });
  };

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
            className="min-w-[48px] min-h-[48px] rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="수량 감소"
          >
            <Minus className="w-5 h-5" />
          </button>
          <span className="w-12 text-center text-lg font-bold text-[#4a3f48]">
            {quantity}
          </span>
          <button
            onClick={() => handleQuantityChange(1)}
            disabled={quantity >= stock || isSoldOut}
            className="min-w-[48px] min-h-[48px] rounded-full border border-[#f5d5e3] flex items-center justify-center text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="수량 증가"
          >
            <Plus className="w-5 h-5" />
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
          disabled={!isLoaded || isSoldOut || isPending}
          variant="outline"
          className="flex-1 h-14 border-2 border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5] rounded-xl text-base font-bold"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          {!isLoaded ? "로딩 중..." : isPending ? "담는 중..." : "장바구니"}
        </Button>
        <Button
          onClick={handleBuyNow}
          disabled={!isLoaded || isSoldOut || isPending}
          className="flex-1 h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold"
        >
          {!isLoaded
            ? "로딩 중..."
            : isSoldOut
            ? "품절"
            : isPending
            ? "처리 중..."
            : "바로 구매"}
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
