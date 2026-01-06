/**
 * @file components/payment-widget.tsx
 * @description TossPayments 결제창 컴포넌트
 *
 * 주요 기능:
 * 1. TossPayments 결제창 자동 호출
 * 2. 오버레이 모달 형태로 결제창 표시
 * 3. 카드사 선택 및 카드 정보 입력 화면 제공
 *
 * @dependencies
 * - @tosspayments/tosspayments-sdk: TossPayments SDK
 */

"use client";

import { useEffect, useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
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
  const [isRequesting, setIsRequesting] = useState(false);

  // 결제창 자동 호출
  useEffect(() => {
    if (isRequesting) return;

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;

    if (!clientKey) {
      logger.error("[PaymentWidget] ❌ NEXT_PUBLIC_TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다.");
      alert("결제 설정이 올바르지 않습니다.");
      onClose?.();
      return;
    }

    logger.group("[PaymentWidget] 결제창 초기화 시작");
    logger.info("주문 정보:", {
      orderId,
      orderName,
      amount: amount.toLocaleString("ko-KR") + "원",
      customerName,
      customerEmail,
      paymentMethod,
    });

    const requestPayment = async () => {
      setIsRequesting(true);

      try {
        logger.info("[PaymentWidget] TossPayments SDK 로드 시작");
        logger.info("[PaymentWidget] 클라이언트 키:", clientKey?.substring(0, 20) + "...");
        
        const tossPayments = await loadTossPayments(clientKey);
        logger.info("[PaymentWidget] ✅ TossPayments SDK 로드 완료");

        // 필수 값 검증 (Payment 인스턴스 생성 전에 먼저 확인)
        if (!orderId || !amount || !customerName || !customerEmail || !paymentMethod) {
          logger.error("[PaymentWidget] ❌ 필수 입력값 누락:", {
            orderId: !!orderId,
            amount: !!amount,
            customerName: !!customerName,
            customerEmail: !!customerEmail,
            paymentMethod: !!paymentMethod,
            actualValues: {
              orderId,
              amount,
              customerName,
              customerEmail,
              paymentMethod,
            }
          });
          alert("결제 정보가 불완전합니다. 페이지를 새로고침해주세요.");
          onClose?.();
          logger.groupEnd();
          return;
        }

        logger.info("[PaymentWidget] 필수 값 검증 완료");
        logger.info("[PaymentWidget] customerKey (이메일):", customerEmail);

        // Payment 인스턴스 생성 (customerKey는 이메일 사용)
        const payment = tossPayments.payment({ customerKey: customerEmail });
        logger.info("[PaymentWidget] ✅ Payment 인스턴스 생성 완료");

        // BASE_URL 설정
        const BASE_URL = window.location.origin;
        logger.info("[PaymentWidget] BASE_URL:", BASE_URL);

        // successUrl과 failUrl - 토스페이먼츠는 {paymentKey}, {orderId}, {amount} 템플릿을 자동 치환
        const successUrl = `${BASE_URL}/order/success`;
        const failUrl = `${BASE_URL}/order/fail`;
        
        logger.info("[PaymentWidget] successUrl:", successUrl);
        logger.info("[PaymentWidget] failUrl:", failUrl);

        // 결제 요청 객체 생성
        const paymentRequest: any = {
          method: paymentMethod === "CARD" ? "CARD" : "TRANSFER",
          amount: {
            currency: "KRW",
            value: amount,
          },
          orderId: orderId,
          orderName: orderName,
          customerName: customerName,
          customerEmail: customerEmail,
          successUrl: successUrl,
          failUrl: failUrl,
        };

        logger.info("[PaymentWidget] 결제 요청 객체 생성 완료:", {
          method: paymentRequest.method,
          amount: paymentRequest.amount,
          orderId: paymentRequest.orderId,
          orderName: paymentRequest.orderName,
        });

        // 결제수단별 추가 설정
        if (paymentMethod === "CARD") {
          // 신용카드 결제
          paymentRequest.card = {
            useEscrow: false,
            flowMode: "DEFAULT", // DEFAULT: 통합 결제창 (카드사 선택 화면 포함)
            useCardPoint: false,
            useAppCardOnly: false,
          };
          logger.info("[PaymentWidget] 신용카드 결제 모드 - 통합 결제창이 오버레이로 표시됩니다");
          logger.info("[PaymentWidget] 카드사 선택 → 약관 동의 → 카드번호/유효기간/CVC 입력 화면이 순서대로 표시됩니다");
        } else if (paymentMethod === "TRANSFER") {
          // 실시간 계좌이체
          paymentRequest.transfer = {
            useEscrow: useEscrow,
          };
          // 입금자명이 있으면 추가
          if (depositorName && depositorName.trim()) {
            paymentRequest.customerName = depositorName.trim();
          }
          logger.info("[PaymentWidget] 계좌이체 결제 모드");
        }

        logger.info("[PaymentWidget] 결제창 호출:", {
          method: paymentRequest.method,
          orderId: paymentRequest.orderId,
          orderName: paymentRequest.orderName,
          amount: paymentRequest.amount,
        });

        // 결제창 호출 - 자동으로 오버레이 모달이 표시됨
        // CARD 모드: 카드사 선택 화면 → 약관 동의 → 카드 정보 입력 화면
        await payment.requestPayment(paymentRequest);
        logger.info("[PaymentWidget] ✅ 결제창 호출 완료 (오버레이 모달 표시됨)");
        logger.groupEnd();
      } catch (err) {
        // 에러 객체를 자세히 로깅
        logger.error("[PaymentWidget] ❌ 결제 요청 에러:", err);
        
        if (err && typeof err === 'object') {
          logger.error("[PaymentWidget] 에러 상세:", {
            name: (err as any).name,
            message: (err as any).message,
            code: (err as any).code,
            stack: (err as any).stack,
            allKeys: Object.keys(err),
            fullError: JSON.stringify(err, null, 2),
          });
        }
        logger.groupEnd();

        // 사용자가 결제창을 닫은 경우는 에러로 처리하지 않음
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
      } finally {
        setIsRequesting(false);
      }
    };

    requestPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // 결제창이 열리는 동안 로딩 표시
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-base font-medium text-[#4a3f48] mb-2">결제창을 불러오는 중...</p>
          <p className="text-sm text-[#8b7d84]">잠시만 기다려주세요</p>
        </div>
      </div>
    </div>
  );
}
