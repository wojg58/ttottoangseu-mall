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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    logger.group("[PaymentWidget] 결제 위젯 초기화 시작");
    logger.debug("주문 정보:", {
      orderId,
      orderName,
      amount: amount.toLocaleString("ko-KR") + "원",
      customerName,
      customerEmail,
      paymentMethod,
    });

    const initializePaymentWidget = async () => {
      try {
        // 클라이언트 키는 환경 변수에서 가져옴
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
        logger.debug("[PaymentWidget] 클라이언트 키 확인:", {
          exists: !!clientKey,
          startsWithTest: clientKey?.startsWith("test_"),
          length: clientKey?.length,
        });
        
        if (!clientKey) {
          throw new Error("TossPayments 클라이언트 키가 설정되지 않았습니다.");
        }

        // customerKey 생성: 이메일을 안전한 형식으로 변환
        // 형식: 영문 대소문자, 숫자, 특수문자('-','_','=','','@')로 최소 2자 이상 최대 50자 이하
        // 이메일 주소를 base64로 인코딩한 후 형식에 맞게 변환
        let customerKey = '';
        try {
          // 이메일을 base64로 인코딩
          const base64Email = btoa(customerEmail).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
          // base64는 이미 영문, 숫자, '-', '_'만 포함하므로 형식에 맞음
          // 길이 제한 확인 (최대 50자)
          customerKey = base64Email.length > 50 ? base64Email.substring(0, 50) : base64Email;
          
          // 최소 길이 확인 (2자 이상)
          if (customerKey.length < 2) {
            // 이메일이 너무 짧으면 이메일의 사용자 부분만 사용
            const emailUser = customerEmail.split('@')[0] || 'user';
            customerKey = emailUser.replace(/[^a-zA-Z0-9\-_=@.]/g, '_').substring(0, 50);
            if (customerKey.length < 2) {
              customerKey = 'customer_' + Date.now().toString().slice(-10);
            }
          }
        } catch (e) {
          // base64 인코딩 실패 시 이메일의 사용자 부분만 사용
          const emailUser = customerEmail.split('@')[0] || 'user';
          customerKey = emailUser.replace(/[^a-zA-Z0-9\-_=@.]/g, '_').substring(0, 50);
          if (customerKey.length < 2) {
            customerKey = 'customer_' + Date.now().toString().slice(-10);
          }
        }
        
        logger.debug("[PaymentWidget] 결제 위젯 로드 시작", {
          clientKeyPrefix: clientKey.substring(0, 10) + "...",
          customerEmail,
          customerKey,
          customerKeyLength: customerKey.length,
        });
        
        const paymentWidget = await loadPaymentWidget(clientKey, customerKey);
        paymentWidgetRef.current = paymentWidget;
        logger.debug("[PaymentWidget] ✅ 결제 위젯 인스턴스 생성 완료");

        setIsLoading(false);
        logger.debug("[PaymentWidget] ✅ 결제 위젯 초기화 완료");
        logger.groupEnd();
      } catch (err) {
        logger.error("[PaymentWidget] ❌ 결제 위젯 초기화 에러:", err);
        setError(
          err instanceof Error
            ? err.message
            : "결제 위젯 초기화에 실패했습니다.",
        );
        setIsLoading(false);
        logger.groupEnd();
      }
    };

    initializePaymentWidget();
  }, [orderId, amount, customerEmail, customerName]);

  // 결제 위젯 초기화 후 자동으로 결제 요청 (오버레이 표시)
  useEffect(() => {
    if (!isLoading && !error && paymentWidgetRef.current && paymentMethod && !isRequesting) {
      logger.info("[PaymentWidget] 결제 위젯 초기화 완료 - 자동 결제 요청 (오버레이 표시)");
      // 약간의 지연 후 결제 요청 (위젯이 완전히 로드되도록)
      const timer = setTimeout(() => {
        handlePayment();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, error, paymentMethod]);

  const handlePayment = async () => {
    if (isRequesting) {
      logger.warn("[PaymentWidget] 이미 결제 요청 중");
      return;
    }

    logger.group("[PaymentWidget] 결제 요청 시작");
    logger.debug("결제 정보:", {
      orderId,
      orderName,
      amount: amount.toLocaleString("ko-KR") + "원",
      paymentMethod,
      customerName,
      customerEmail,
    });
    logger.debug("결제 위젯 상태:", {
      paymentWidget: !!paymentWidgetRef.current,
      isLoading,
      error,
    });

    // 계좌이체 선택 시 입금자명 검증
    if (paymentMethod === "TRANSFER" && (!depositorName || !depositorName.trim())) {
      logger.warn("[PaymentWidget] 입금자명 미입력");
      alert("입금자명을 입력해주세요.");
      logger.groupEnd();
      return;
    }

    if (!paymentWidgetRef.current) {
      logger.error("[PaymentWidget] ❌ 결제 위젯이 초기화되지 않음");
      alert("결제 위젯을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      logger.groupEnd();
      return;
    }

    if (isLoading) {
      logger.error("[PaymentWidget] ❌ 결제 위젯이 아직 로딩 중");
      alert("결제 위젯을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      logger.groupEnd();
      return;
    }

    if (error) {
      logger.error("[PaymentWidget] ❌ 결제 위젯 초기화 에러:", error);
      alert(`결제 위젯 오류: ${error}`);
      logger.groupEnd();
      return;
    }

    setIsRequesting(true);

    try {
      // 필수 값 검증
      if (!orderId || !amount || !customerName || !customerEmail || !paymentMethod) {
        logger.error("[PaymentWidget] ❌ 필수 입력값 누락:", {
          orderId: !!orderId,
          amount: !!amount,
          customerName: !!customerName,
          customerEmail: !!customerEmail,
          paymentMethod: !!paymentMethod,
        });
        alert("결제 정보가 불완전합니다. 페이지를 새로고침해주세요.");
        logger.groupEnd();
        setIsRequesting(false);
        return;
      }

      // BASE_URL 설정
      const BASE_URL = window.location.origin;

      // 결제 위젯 실행 (TossPayments 위젯이 자동으로 오버레이로 결제창 표시)
      const paymentRequest: any = {
        orderId: orderId,
        orderName: orderName,
        customerName,
        customerEmail,
        successUrl: `${BASE_URL}/order/success?paymentKey={paymentKey}&orderId=${orderId}&amount=${amount}`,
        failUrl: `${BASE_URL}/order/fail?message={message}`,
      };

      // 결제수단에 따라 method 지정
      if (paymentMethod === "CARD") {
        // 신용카드 결제
        paymentRequest.method = "카드";
      } else if (paymentMethod === "TRANSFER") {
        // 실시간 계좌이체
        paymentRequest.method = "계좌이체";
        paymentRequest.transfer = {
          useEscrow: useEscrow,
        };
        // 입금자명이 있으면 추가
        if (depositorName && depositorName.trim()) {
          paymentRequest.customerName = depositorName.trim();
        }
      }

      logger.info("[PaymentWidget] TossPayments 결제 위젯 실행 (오버레이):", {
        orderId: paymentRequest.orderId,
        orderName: paymentRequest.orderName,
        paymentMethod,
        method: paymentRequest.method,
        successUrl: paymentRequest.successUrl,
        failUrl: paymentRequest.failUrl,
      });
      
      try {
        logger.debug("[PaymentWidget] requestPayment 호출 직전");
        // requestPayment 호출 시 자동으로 오버레이 형태로 결제창이 표시됨
        await paymentWidgetRef.current.requestPayment(paymentRequest);
        logger.debug("[PaymentWidget] ✅ requestPayment 호출 완료 (오버레이 표시됨)");
      } catch (paymentError) {
        logger.error("[PaymentWidget] ❌ requestPayment 에러:", {
          name: paymentError instanceof Error ? paymentError.name : undefined,
          message: paymentError instanceof Error ? paymentError.message : String(paymentError),
          stack: paymentError instanceof Error ? paymentError.stack : undefined,
        });
        throw paymentError;
      }

      logger.groupEnd();
    } catch (err) {
      logger.error("[PaymentWidget] ❌ 결제 요청 전체 프로세스 에러:", {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      const errorMessage = err instanceof Error ? err.message : "결제 요청에 실패했습니다.";
      alert(errorMessage);
      setIsRequesting(false);
      logger.groupEnd();
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

  // 에러 메시지 표시
  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-red-500 mt-2">
            ⚠️ 결제 위젯 초기화에 문제가 있습니다. 페이지를 새로고침해주세요.
          </p>
        </div>
        {onClose && (
          <Button
            onClick={onClose}
            className="w-full bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            닫기
          </Button>
        )}
      </div>
    );
  }

  // 결제 위젯이 초기화되면 자동으로 결제 요청이 시작되므로
  // 여기서는 로딩 상태만 표시
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
        <p className="text-sm text-[#8b7d84]">결제창을 불러오는 중...</p>
      </div>
      {onClose && (
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full border-[#f5d5e3] text-[#4a3f48] hover:bg-[#fef8fb]"
        >
          취소
        </Button>
      )}
    </div>
  );
}
