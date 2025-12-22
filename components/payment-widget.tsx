/**
 * @file components/payment-widget.tsx
 * @description TossPayments 결제 위젯 컴포넌트
 *
 * 주요 기능:
 * 1. TossPayments 결제 위젯 초기화
 * 2. 결제 요청 처리
 * 3. 결제 완료/실패 처리
 *
 * @dependencies
 * - @tosspayments/payment-widget-sdk: TossPayments 결제 위젯 SDK
 */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  PaymentWidgetInstance,
  loadPaymentWidget,
} from "@tosspayments/payment-widget-sdk";
import { Button } from "@/components/ui/button";

interface PaymentWidgetProps {
  orderId: string;
  orderNumber: string;
  amount: number;
  customerName: string;
  customerEmail: string;
}

export default function PaymentWidget({
  orderId,
  orderNumber,
  amount,
  customerName,
  customerEmail,
}: PaymentWidgetProps) {
  const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"카드" | "계좌이체">("카드");
  const [depositorName, setDepositorName] = useState("");
  const [useEscrow, setUseEscrow] = useState(false);
  const [installment, setInstallment] = useState<"일시불" | "할부">("일시불");

  useEffect(() => {
    console.group("[PaymentWidget] 초기화");
    console.log("주문 ID:", orderId);
    console.log("주문번호:", orderNumber);
    console.log("결제 금액:", amount);

    const initializePaymentWidget = async () => {
      try {
        // 클라이언트 키는 환경 변수에서 가져옴
        const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
        console.log("[PaymentWidget] 클라이언트 키 확인:", {
          exists: !!clientKey,
          startsWithTest: clientKey?.startsWith("test_"),
          length: clientKey?.length,
        });
        
        if (!clientKey) {
          throw new Error("TossPayments 클라이언트 키가 설정되지 않았습니다.");
        }

        console.log("[PaymentWidget] 결제 위젯 로드 시작", {
          clientKey: clientKey.substring(0, 10) + "...",
          customerEmail,
        });
        
        const paymentWidget = await loadPaymentWidget(clientKey, customerEmail);
        paymentWidgetRef.current = paymentWidget;
        console.log("[PaymentWidget] 결제 위젯 인스턴스 생성 완료");

        setIsLoading(false);
        console.log("결제 위젯 초기화 완료");
        console.groupEnd();
      } catch (err) {
        console.error("결제 위젯 초기화 에러:", err);
        setError(
          err instanceof Error
            ? err.message
            : "결제 위젯 초기화에 실패했습니다.",
        );
        setIsLoading(false);
        console.groupEnd();
      }
    };

    initializePaymentWidget();
  }, [orderId, orderNumber, amount, customerEmail]);

  const handlePayment = async () => {
    console.group("[PaymentWidget] 결제 요청");
    console.log("주문 ID:", orderId);
    console.log("주문번호:", orderNumber);
    console.log("결제 금액:", amount);
    console.log("결제 수단:", paymentMethod);
    console.log("결제 위젯 상태:", {
      paymentWidget: !!paymentWidgetRef.current,
      isLoading,
      error,
    });

    // 계좌이체 선택 시 입금자명 검증
    if (paymentMethod === "계좌이체" && !depositorName.trim()) {
      alert("입금자명을 입력해주세요.");
      console.groupEnd();
      return;
    }

    if (!paymentWidgetRef.current) {
      console.error("결제 위젯이 초기화되지 않았습니다.");
      alert("결제 위젯을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      console.groupEnd();
      return;
    }

    if (isLoading) {
      console.error("결제 위젯이 아직 로딩 중입니다.");
      alert("결제 위젯을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      console.groupEnd();
      return;
    }

    if (error) {
      console.error("결제 위젯 초기화 에러:", error);
      alert(`결제 위젯 오류: ${error}`);
      console.groupEnd();
      return;
    }

    try {
      // 결제 요청 API 호출 (결제 정보 저장)
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          orderNumber,
          amount,
          customerName,
          customerEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "결제 요청에 실패했습니다.");
      }

      console.log("결제 요청 성공, 결제 위젯 실행");
      console.log("결제 정보:", data);

      // 결제 위젯 실행 (TossPayments 위젯이 자동으로 결제 처리)
      // orderId는 원래 주문 ID를 사용해야 함 (paymentId가 아님)
      const paymentRequest = {
        orderId: orderId, // 원래 주문 ID 사용
        orderName: `주문번호: ${orderNumber}`,
        customerName,
        customerEmail,
        successUrl: `${window.location.origin}/payments/success?paymentKey={paymentKey}&orderId=${orderId}&amount=${amount}`,
        failUrl: `${window.location.origin}/payments/fail?message={message}`,
        flowMode: "DIRECT" as const, // 결제창 바로 열기
        easyPay: paymentMethod === "카드" ? "토스페이" : undefined,
      };

      console.log("[PaymentWidget] requestPayment 호출:", paymentRequest);
      console.log("[PaymentWidget] 선택된 결제수단:", paymentMethod);
      
      try {
        console.log("[PaymentWidget] requestPayment 호출 직전");
        const result = await paymentWidgetRef.current.requestPayment(paymentRequest);
        console.log("[PaymentWidget] requestPayment 성공, 결과:", result);
        // requestPayment는 Promise를 반환하지만, 실제로는 결제 페이지로 리다이렉트되므로
        // 여기까지 도달하는 경우는 드뭅니다.
      } catch (paymentError) {
        console.error("[PaymentWidget] requestPayment 에러:", paymentError);
        console.error("[PaymentWidget] 에러 상세:", {
          name: paymentError instanceof Error ? paymentError.name : undefined,
          message: paymentError instanceof Error ? paymentError.message : String(paymentError),
          stack: paymentError instanceof Error ? paymentError.stack : undefined,
        });
        throw paymentError;
      }

      console.groupEnd();
    } catch (err) {
      console.error("결제 요청 에러:", err);
      const errorMessage = err instanceof Error ? err.message : "결제 요청에 실패했습니다.";
      console.error("[PaymentWidget] 에러 상세:", {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      });
      alert(errorMessage);
      console.groupEnd();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-sm text-[#8b7d84]">결제 위젯을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 결제 수단 선택 */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-[#4a3f48]">결제수단</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentMethod"
              value="카드"
              checked={paymentMethod === "카드"}
              onChange={(e) => setPaymentMethod(e.target.value as "카드")}
              className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
            />
            <span className="text-sm text-[#4a3f48]">카드 결제</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentMethod"
              value="계좌이체"
              checked={paymentMethod === "계좌이체"}
              onChange={(e) => setPaymentMethod(e.target.value as "계좌이체")}
              className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
            />
            <span className="text-sm text-[#4a3f48]">에스크로(실시간 계좌이체)</span>
          </label>
        </div>
      </div>

      {/* 계좌이체 선택 시 추가 입력 필드 */}
      {paymentMethod === "계좌이체" && (
        <div className="space-y-4 p-4 border border-[#f5d5e3] rounded-lg bg-[#fef8fb]">
          {/* 입금자명 */}
          <div>
            <label className="block text-sm font-medium text-[#4a3f48] mb-2">
              입금자명 <span className="text-[#ff6b9d]">*</span>
            </label>
            <input
              type="text"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              placeholder="입금자명을 입력하세요"
              className="w-full px-3 py-2 border border-[#f5d5e3] rounded-md text-sm focus:outline-none focus:border-[#ff6b9d] focus:ring-1 focus:ring-[#ff6b9d]"
            />
          </div>

          {/* 에스크로 서비스 */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="escrow"
              checked={useEscrow}
              onChange={(e) => setUseEscrow(e.target.checked)}
              className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] rounded focus:ring-[#ff6b9d] mt-0.5"
            />
            <label htmlFor="escrow" className="text-xs text-[#4a3f48]">
              에스크로(구매안전) 서비스를 적용합니다.
            </label>
          </div>

          <div className="text-xs text-[#ff6b9d] bg-white p-3 rounded border border-[#fad2e6]">
            ⚠️ 소액 결제의 경우 PG사 정책에 따라 관련 금융 결제 수단의 인증 후 사용이 가능합니다.
          </div>

          {/* 할부 결제 옵션 */}
          <div>
            <h4 className="text-sm font-medium text-[#4a3f48] mb-2">할부결제 선택</h4>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="installment"
                  value="할부"
                  checked={installment === "할부"}
                  onChange={(e) => setInstallment(e.target.value as "할부")}
                  className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
                />
                <span className="text-sm text-[#4a3f48]">할부결제 승인</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="installment"
                  value="일시불"
                  checked={installment === "일시불"}
                  onChange={(e) => setInstallment(e.target.value as "일시불")}
                  className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
                />
                <span className="text-sm text-[#4a3f48]">일시불</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 최종 결제 금액 */}
      <div className="border-t border-[#f5d5e3] pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#8b7d84]">
            {paymentMethod === "카드" ? "카드결제" : "계좌이체"} 최종 금액
          </span>
          <span className="text-2xl font-bold text-[#ff6b9d]">
            {amount.toLocaleString("ko-KR")}원
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8b7d84] text-center">
        {paymentMethod === "카드" 
          ? "결제하기 버튼을 클릭하면 토스페이먼츠 결제창이 열립니다."
          : "입금자명을 확인하시고 결제하기 버튼을 클릭해주세요."}
      </p>

      {/* 결제 버튼 */}
      <Button
        onClick={handlePayment}
        disabled={isLoading || (paymentMethod === "계좌이체" && !depositorName.trim())}
        className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        결제하기
      </Button>
    </div>
  );
}
