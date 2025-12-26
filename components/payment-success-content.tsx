/**
 * @file components/payment-success-content.tsx
 * @description 결제 성공 콘텐츠 컴포넌트
 */

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Home, Package } from "lucide-react";
import PaymentStatusCard from "@/components/payment-status-card";
import logger from "@/lib/logger";

export default function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    logger.group("[PaymentSuccessContent] 결제 완료 페이지");

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    logger.debug("결제 정보:", { paymentKey, orderId, amount });

    if (!paymentKey || !orderId || !amount) {
      logger.debug("필수 파라미터 누락");
      router.push("/payments/fail?message=결제 정보가 올바르지 않습니다.");
      logger.groupEnd();
      return;
    }

    const confirmPayment = async () => {
      try {
        logger.debug("[PaymentSuccessContent] 결제 승인 API 호출 시작", {
          paymentKey: paymentKey?.substring(0, 10) + "...",
          orderId,
          amount: Number(amount).toLocaleString("ko-KR") + "원",
        });
        
        const response = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
          }),
        });

        logger.debug("[PaymentSuccessContent] 결제 승인 API 응답 수신", {
          status: response.status,
          ok: response.ok,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          logger.error("[PaymentSuccessContent] ❌ 결제 승인 실패:", {
            success: data.success,
            message: data.message,
            status: response.status,
          });
          router.push(
            `/payments/fail?message=${encodeURIComponent(data.message || "결제 승인에 실패했습니다.")}`
          );
          logger.groupEnd();
          return;
        }

        logger.debug("[PaymentSuccessContent] ✅ 결제 승인 성공:", {
          orderNumber: data.orderNumber || orderId.substring(0, 8),
          paymentKey: data.paymentKey?.substring(0, 10) + "...",
        });
        logger.debug("[PaymentSuccessContent] 네이버 동기화 큐는 서버에서 자동 처리됩니다.");
        
        setOrderNumber(data.orderNumber || orderId.substring(0, 8));
        setIsLoading(false);
        logger.groupEnd();
      } catch (error) {
        logger.error("[PaymentSuccessContent] ❌ 결제 승인 처리 에러:", {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        router.push("/payments/fail?message=결제 처리 중 오류가 발생했습니다.");
        logger.groupEnd();
      }
    };

    confirmPayment();
  }, [searchParams, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-sm text-[#8b7d84]">결제를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <PaymentStatusCard
      icon={CheckCircle2}
      iconBgClass="bg-[#ffeef5]"
      iconColorClass="text-[#ff6b9d]"
      title="결제가 완료되었습니다!"
      message="주문해주셔서 감사합니다."
      orderNumber={orderNumber ?? undefined}
      actions={[
        { label: "홈으로", href: "/", icon: Home },
        { label: "주문 내역 보기", href: "/mypage/orders", icon: Package, primary: true },
      ]}
    />
  );
}
