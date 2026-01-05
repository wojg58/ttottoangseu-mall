/**
 * @file components/payment-widget.tsx
 * @description TossPayments Payment Widget 컴포넌트
 *
 * 주요 기능:
 * 1. TossPayments Payment Widget 렌더링
 * 2. 카드사 선택 UI 표시
 * 3. 약관 동의 체크박스 자동 표시 (카드사 선택 후)
 * 4. 카드 정보 입력 화면으로 진행
 *
 * @dependencies
 * - @tosspayments/payment-widget-sdk: TossPayments Payment Widget SDK
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { loadPaymentWidget, PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";
import { Button } from "@/components/ui/button";
import logger from "@/lib/logger";

interface PaymentWidgetProps {
  orderId: string;
  amount: number;
  orderName: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: "CARD" | "TRANSFER";
  depositorName?: string;
  useEscrow?: boolean;
  onClose?: () => void;
}

export default function PaymentWidget({
  orderId,
  amount,
  orderName,
  customerName,
  customerEmail,
  paymentMethod,
  depositorName,
  useEscrow = false,
  onClose,
}: PaymentWidgetProps) {
  const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);
  const paymentMethodsWidgetRef = useRef<ReturnType<PaymentWidgetInstance["renderPaymentMethods"]> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment Widget 초기화 및 렌더링
  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;

    if (!clientKey) {
      logger.error("[PaymentWidget] ❌ NEXT_PUBLIC_TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다.");
      setError("결제 설정이 올바르지 않습니다.");
      setIsLoading(false);
      return;
    }

    logger.group("[PaymentWidget] Payment Widget 초기화 시작");
    logger.info("주문 정보:", {
      orderId,
      orderName,
      amount: amount.toLocaleString("ko-KR") + "원",
      customerName,
      customerEmail,
      paymentMethod,
    });

    const initializeWidget = async () => {
      try {
        logger.info("[PaymentWidget] loadPaymentWidget 호출");
        
        // Payment Widget 로드
        const paymentWidget = await loadPaymentWidget(clientKey, customerEmail);
        paymentWidgetRef.current = paymentWidget;
        
        logger.info("[PaymentWidget] ✅ Payment Widget 로드 완료");

        // 금액 설정
        await paymentWidget.setAmount({
          currency: "KRW",
          value: amount,
        });
        
        logger.info("[PaymentWidget] ✅ 금액 설정 완료:", amount);

        // 결제 수단 렌더링 (카드만 표시)
        const paymentMethodsWidget = await paymentWidget.renderPaymentMethods({
          selector: "#payment-widget",
          variantKey: "DEFAULT",
        });
        
        paymentMethodsWidgetRef.current = paymentMethodsWidget;
        
        logger.info("[PaymentWidget] ✅ 결제 수단 UI 렌더링 완료");
        logger.info("[PaymentWidget] 카드사를 선택하면 약관 동의 체크박스가 자동으로 표시됩니다");

        setIsLoading(false);
        logger.groupEnd();
      } catch (err) {
        logger.error("[PaymentWidget] ❌ 초기화 실패:", err);
        logger.groupEnd();
        setError("결제 위젯을 불러오는데 실패했습니다.");
        setIsLoading(false);
      }
    };

    initializeWidget();

    // Cleanup
    return () => {
      if (paymentMethodsWidgetRef.current) {
        try {
          paymentMethodsWidgetRef.current.destroy?.();
        } catch (err) {
          logger.warn("[PaymentWidget] cleanup 중 에러:", err);
        }
      }
    };
  }, [orderId, amount, orderName, customerName, customerEmail, paymentMethod]);

  // 결제하기 버튼 클릭
  const handlePayment = async () => {
    if (!paymentWidgetRef.current) {
      logger.error("[PaymentWidget] Payment Widget이 초기화되지 않았습니다");
      alert("결제 위젯이 초기화되지 않았습니다. 페이지를 새로고침해주세요.");
      return;
    }

    try {
      logger.group("[PaymentWidget] 결제 요청 시작");

      const BASE_URL = window.location.origin;

      logger.info("[PaymentWidget] requestPayment 호출");
      
      // 결제 요청
      await paymentWidgetRef.current.requestPayment({
        orderId: orderId,
        orderName: orderName,
        customerName: customerName,
        customerEmail: customerEmail,
        successUrl: `${BASE_URL}/order/success`,
        failUrl: `${BASE_URL}/order/fail`,
      });

      logger.info("[PaymentWidget] ✅ 결제 요청 완료");
      logger.groupEnd();
    } catch (err) {
      logger.error("[PaymentWidget] ❌ 결제 요청 에러:", err);
      
      if (err && typeof err === 'object') {
        logger.error("[PaymentWidget] 에러 상세:", {
          name: (err as any).name,
          message: (err as any).message,
          code: (err as any).code,
        });
      }
      logger.groupEnd();

      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = (err as any)?.code || '';
      
      if (!errorMessage.includes("CANCELED") && 
          !errorMessage.includes("USER_CANCEL") &&
          errorCode !== "USER_CANCEL") {
        alert(`결제 요청 중 오류가 발생했습니다.\n\n에러 코드: ${errorCode}\n에러 메시지: ${errorMessage}`);
      } else {
        logger.info("[PaymentWidget] 사용자가 결제를 취소했습니다");
      }

      onClose?.();
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
            <p className="text-base font-medium text-[#4a3f48] mb-2">결제위젯을 불러오는 중...</p>
            <p className="text-sm text-[#8b7d84]">잠시만 기다려주세요</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="text-center">
            <p className="text-base font-medium text-red-600 mb-4">{error}</p>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
            >
              닫기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#4a3f48]">결제하기</h2>
          <button
            onClick={onClose}
            className="text-[#8b7d84] hover:text-[#4a3f48] text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-4 bg-[#fef8fb] rounded-lg border border-[#f5d5e3]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[#8b7d84]">주문명</span>
            <span className="text-sm font-medium text-[#4a3f48]">{orderName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#8b7d84]">결제 금액</span>
            <span className="text-lg font-bold text-[#ff6b9d]">{amount.toLocaleString("ko-KR")}원</span>
          </div>
        </div>

        {/* Payment Widget 렌더링 영역 */}
        <div id="payment-widget" className="mb-4"></div>

        <div className="bg-[#fffaeb] border border-[#ffeaa7] rounded-lg p-4 mb-4">
          <p className="text-sm text-[#4a3f48] mb-2">
            <strong>💡 테스트 방법:</strong>
          </p>
          <ol className="text-sm text-[#8b7d84] space-y-1 list-decimal list-inside">
            <li>위 화면에서 <strong>카드사</strong>를 선택하세요 (토스페이, 페이북, 삼성카드 등)</li>
            <li>카드사를 선택하면 하단에 <strong>약관 동의 체크박스</strong>가 자동으로 표시됩니다</li>
            <li>약관에 동의한 후 아래 <strong>결제하기</strong> 버튼을 클릭하세요</li>
          </ol>
        </div>

        <Button
          onClick={handlePayment}
          className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5a8d] text-white rounded-lg text-base font-bold"
        >
          {amount.toLocaleString("ko-KR")}원 결제하기
        </Button>
      </div>
    </div>
  );
}
