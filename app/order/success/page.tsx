/**
 * @file app/order/success/page.tsx
 * @description 결제 성공 페이지
 * 
 * 주요 기능:
 * 1. 쿼리 파라미터에서 paymentKey, orderId, amount 받기
 * 2. confirm API 호출
 * 3. 성공 UI 표시
 * 
 * @dependencies
 * - next/navigation: 쿼리 파라미터 처리
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import logger from "@/lib/logger-client";
import CartUpdateTrigger from "@/components/cart-update-trigger";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    orderId?: string;
    method?: string;
    virtualAccount?: {
      accountNumber: string;
      bankCode: string;
      customerName: string;
      dueDate: string;
      refundStatus: string;
    };
    transfer?: {
      bankCode: string;
      settlementStatus: string;
    };
  } | null>(null);

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      logger.error("[OrderSuccessPage] 필수 파라미터 누락");
      setResult({
        success: false,
        message: "잘못된 결제 요청입니다.",
      });
      setIsProcessing(false);
      return;
    }

    const amountNumber = parseInt(amount, 10);
    if (isNaN(amountNumber)) {
      logger.error("[OrderSuccessPage] 잘못된 금액 형식", { amount });
      setResult({
        success: false,
        message: "잘못된 결제 금액입니다.",
      });
      setIsProcessing(false);
      return;
    }

    // confirm API 호출
    const confirmPayment = async () => {
      try {
        const response = await fetch("/api/payments/toss/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: amountNumber,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          logger.error("[OrderSuccessPage] 결제 승인 실패", {
            message: data.message,
          });
        }

        setResult({
          success: data.success,
          message: data.message,
          orderId: data.orderId,
          method: data.method,
          virtualAccount: data.virtualAccount,
        });

        // 결제 성공 시 장바구니 갱신 이벤트 발생
        if (data.success) {
          logger.debug("[OrderSuccessPage] 결제 성공 - 장바구니 갱신 이벤트 발생");
          window.dispatchEvent(new CustomEvent("cart:update"));
        }
      } catch (error) {
        logger.error("[OrderSuccessPage] confirm API 호출 에러", error);
        setResult({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "결제 승인 처리 중 오류가 발생했습니다.",
        });
      } finally {
        setIsProcessing(false);
      }
    };

    confirmPayment();
  }, [searchParams]);

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-sm text-[#8b7d84]">결제 승인 처리 중...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  // 가상계좌 정보가 있으면 입금 대기 페이지로 리다이렉트 (실시간 계좌이체는 제외)
  if (
    result.success &&
    result.virtualAccount &&
    result.virtualAccount.accountNumber
  ) {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    router.push(
      `/order/waiting-deposit?paymentKey=${paymentKey}&orderId=${orderId}&amount=${amount}`
    );
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-sm text-[#8b7d84]">입금 대기 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-600 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#4a3f48] mb-4">
            결제 승인 실패
          </h1>
          <p className="text-[#8b7d84] mb-8">{result.message}</p>
          <Button
            onClick={() => router.push("/order")}
            className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  // 실시간 계좌이체 여부 확인
  const isTransfer = result.method === "TRANSFER" || result.method === "transfer";

  return (
    <>
      {/* 결제 성공 시 장바구니 개수 즉시 갱신 */}
      {result.success && <CartUpdateTrigger />}
      <div className="flex items-center justify-center min-h-screen bg-[#fef8fb]">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-2xl shadow-sm">
          {/* 성공 아이콘 */}
          <div className="w-20 h-20 bg-[#ffeef5] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#ff6b9d]" />
          </div>

          <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
            결제가 완료되었습니다
          </h1>
          
          {/* 실시간 계좌이체 안내 */}
          {isTransfer && (
            <div className="bg-[#ffeef5] rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-medium text-[#4a3f48] mb-2">
                💳 결제 수단: 실시간 계좌이체
              </p>
              <p className="text-xs text-[#8b7d84] mb-1">
                ✓ 에스크로(구매안전서비스)가 적용되었습니다.
              </p>
              <p className="text-xs text-[#8b7d84]">
                ✓ 결제가 즉시 완료되었습니다.
              </p>
            </div>
          )}

          <p className="text-[#8b7d84] mb-4">{result.message}</p>
          
          {result.orderId && (
            <div className="bg-[#fef8fb] rounded-lg p-4 mb-6">
              <p className="text-sm text-[#8b7d84] mb-1">주문번호</p>
              <p className="text-base font-semibold text-[#4a3f48]">
                {result.orderId}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={() => router.push("/mypage/orders")}
              className="w-full bg-[#ff6b9d] hover:bg-[#ff5088] text-white h-12 text-base font-medium"
            >
              주문 내역 보기
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="w-full border-[#f5d5e3] text-[#4a3f48] hover:bg-[#fef8fb] h-12 text-base"
            >
              홈으로 가기
            </Button>
          </div>

          {/* 안내 문구 */}
          <p className="text-xs text-[#8b7d84] mt-6">
            주문 내역은 마이페이지에서 확인하실 수 있습니다.
          </p>
        </div>
      </div>
    </>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-sm text-[#8b7d84]">로딩 중...</p>
        </div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}

