/**
 * @file components/payment-success-content.tsx
 * @description 결제 성공 콘텐츠 컴포넌트
 */

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Home, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    console.group("[PaymentSuccessContent] 결제 완료 페이지");
    
    // URL 파라미터에서 결제 정보 확인
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    console.log("결제 정보:", { paymentKey, orderId, amount });

    if (!paymentKey || !orderId || !amount) {
      console.log("필수 파라미터 누락");
      router.push("/payments/fail?message=결제 정보가 올바르지 않습니다.");
      console.groupEnd();
      return;
    }

    // 결제 승인 처리
    const confirmPayment = async () => {
      try {
        console.log("결제 승인 API 호출");
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

        const data = await response.json();

        if (!response.ok || !data.success) {
          console.error("결제 승인 실패:", data);
          router.push(`/payments/fail?message=${encodeURIComponent(data.message || "결제 승인에 실패했습니다.")}`);
          console.groupEnd();
          return;
        }

        console.log("결제 승인 성공:", data);
        
        // 주문번호 설정
        setOrderNumber(data.orderNumber || orderId.substring(0, 8));
        setIsLoading(false);
        console.groupEnd();
      } catch (error) {
        console.error("결제 승인 처리 에러:", error);
        router.push("/payments/fail?message=결제 처리 중 오류가 발생했습니다.");
        console.groupEnd();
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
    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-[#ffeef5] rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-[#ff6b9d]" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">결제가 완료되었습니다!</h1>
      <p className="text-sm text-[#8b7d84] mb-8">
        주문해주셔서 감사합니다.
      </p>

      {orderNumber && (
        <div className="bg-[#ffeef5] rounded-lg p-4 mb-8">
          <p className="text-sm text-[#8b7d84] mb-1">주문번호</p>
          <p className="text-lg font-bold text-[#4a3f48]">{orderNumber}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          asChild
          variant="outline"
          className="border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
        >
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            홈으로
          </Link>
        </Button>
        <Button
          asChild
          className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
        >
          <Link href="/mypage/orders">
            <Package className="w-4 h-4 mr-2" />
            주문 내역 보기
          </Link>
        </Button>
      </div>
    </div>
  );
}

