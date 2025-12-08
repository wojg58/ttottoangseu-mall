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
  const paymentMethodsWidgetRef = useRef<ReturnType<
    PaymentWidgetInstance["renderPaymentMethods"]
  > | null>(null);
  const agreementWidgetRef = useRef<ReturnType<
    PaymentWidgetInstance["renderAgreement"]
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.group("[PaymentWidget] 초기화");
    console.log("주문 ID:", orderId);
    console.log("주문번호:", orderNumber);
    console.log("결제 금액:", amount);

    const initializePaymentWidget = async () => {
      try {
        // 클라이언트 키는 환경 변수에서 가져옴
        const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
        if (!clientKey) {
          throw new Error("TossPayments 클라이언트 키가 설정되지 않았습니다.");
        }

        console.log("결제 위젯 로드 시작");
        const paymentWidget = await loadPaymentWidget(clientKey, customerEmail);
        paymentWidgetRef.current = paymentWidget;

        // 결제 수단 위젯 렌더링
        const paymentMethodsWidget = paymentWidget.renderPaymentMethods(
          "#payment-method",
          { value: amount },
          { variantKey: "DEFAULT" },
        );
        paymentMethodsWidgetRef.current = paymentMethodsWidget;

        // 이용약관 위젯 렌더링
        const agreementWidget = paymentWidget.renderAgreement("#agreement", {
          variantKey: "AGREEMENT",
        });
        agreementWidgetRef.current = agreementWidget;

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

    // cleanup
    return () => {
      // Payment widget cleanup is handled automatically
      paymentMethodsWidgetRef.current = null;
      agreementWidgetRef.current = null;
    };
  }, [orderId, orderNumber, amount, customerEmail]);

  const handlePayment = async () => {
    console.group("[PaymentWidget] 결제 요청");
    console.log("주문 ID:", orderId);
    console.log("주문번호:", orderNumber);
    console.log("결제 금액:", amount);

    if (!paymentWidgetRef.current) {
      console.error("결제 위젯이 초기화되지 않았습니다.");
      alert("결제 위젯을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
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
      await paymentWidgetRef.current.requestPayment({
        orderId: data.paymentId || orderId,
        orderName: `주문번호: ${orderNumber}`,
        customerName,
        customerEmail,
        successUrl: `${window.location.origin}/payments/success?paymentKey={paymentKey}&orderId=${orderId}&amount=${amount}`,
        failUrl: `${window.location.origin}/payments/fail?message={message}`,
      });

      console.groupEnd();
    } catch (err) {
      console.error("결제 요청 에러:", err);
      alert(err instanceof Error ? err.message : "결제 요청에 실패했습니다.");
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
      <div>
        <h3 className="text-base font-bold text-[#4a3f48] mb-4">결제 수단</h3>
        <div id="payment-method" className="min-h-[200px]"></div>
      </div>

      {/* 이용약관 */}
      <div>
        <h3 className="text-base font-bold text-[#4a3f48] mb-4">이용약관</h3>
        <div id="agreement" className="min-h-[100px]"></div>
      </div>

      {/* 결제 버튼 */}
      <Button
        onClick={handlePayment}
        className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold"
      >
        {amount.toLocaleString("ko-KR")}원 결제하기
      </Button>
    </div>
  );
}
