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
  const [error, setError] = useState<string | null>(null);

  // 결제창 자동 호출
  useEffect(() => {
    if (isRequesting) return;
    
    // 에러 상태 초기화
    setError(null);

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;

    if (!clientKey) {
      const errorMsg = "결제 설정이 올바르지 않습니다. (NEXT_PUBLIC_TOSS_CLIENT_KEY 환경변수 미설정)";
      logger.error("[PaymentWidget] ❌", errorMsg);
      setError(errorMsg);
      alert(errorMsg);
      setTimeout(() => onClose?.(), 2000);
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
          const errorMsg = "결제 정보가 불완전합니다. 페이지를 새로고침해주세요.";
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
          setError(errorMsg);
          alert(errorMsg);
          setTimeout(() => onClose?.(), 2000);
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
          // 입금자명이 있으면 customerName에 설정 (실시간 계좌이체에서 입금자명으로 사용)
          if (depositorName && depositorName.trim()) {
            paymentRequest.customerName = depositorName.trim();
            logger.info("[PaymentWidget] 입금자명 설정:", depositorName.trim());
          }
          logger.info("[PaymentWidget] 실시간 계좌이체 결제 모드");
          logger.info("[PaymentWidget] 에스크로 사용 여부:", useEscrow);
          logger.info("[PaymentWidget] 계좌이체 팝업창이 오버레이로 표시됩니다");
          logger.info("[PaymentWidget] 은행 선택 → 계좌번호 입력 → 인증 화면이 순서대로 표시됩니다");
        }

        logger.info("[PaymentWidget] 결제창 호출:", {
          method: paymentRequest.method,
          orderId: paymentRequest.orderId,
          orderName: paymentRequest.orderName,
          amount: paymentRequest.amount,
          transfer: paymentRequest.transfer,
          customerName: paymentRequest.customerName,
        });

        // 결제창 호출 - 자동으로 오버레이 모달이 표시됨
        // CARD 모드: 카드사 선택 화면 → 약관 동의 → 카드 정보 입력 화면
        // TRANSFER 모드: 은행 선택 화면 → 계좌번호 입력 → 인증 화면
        logger.info("[PaymentWidget] payment.requestPayment() 호출 시작");
        await payment.requestPayment(paymentRequest);
        logger.info("[PaymentWidget] ✅ 결제창 호출 완료 (오버레이 모달 표시됨)");
        if (paymentMethod === "TRANSFER") {
          logger.info("[PaymentWidget] 실시간 계좌이체 팝업창이 활성화되었습니다");
        }
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
          const errorMsg = `결제 요청 중 오류가 발생했습니다.\n\n에러 코드: ${errorCode}\n에러 메시지: ${errorMessage}`;
          setError(errorMsg);
          alert(errorMsg);
          setTimeout(() => onClose?.(), 3000);
        } else {
          logger.info("[PaymentWidget] 사용자가 결제를 취소했습니다");
          onClose?.();
        }
      } finally {
        setIsRequesting(false);
      }
    };

    requestPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 마운트 시 한 번만 실행 (key prop으로 재마운트 제어)

  // 에러가 발생한 경우 에러 메시지 표시
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <p className="text-base font-medium text-[#4a3f48] mb-2">결제 오류</p>
            <p className="text-sm text-[#8b7d84] mb-4 whitespace-pre-line">{error}</p>
            <button
              onClick={() => onClose?.()}
              className="px-4 py-2 bg-[#ff6b9d] text-white rounded-lg hover:bg-[#ff5a8d] transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 결제창이 열리는 동안 로딩 표시
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-base font-medium text-[#4a3f48] mb-2">결제창을 불러오는 중...</p>
          <p className="text-sm text-[#8b7d84]">잠시만 기다려주세요</p>
          {paymentMethod === "TRANSFER" && (
            <p className="text-xs text-[#8b7d84] mt-2">실시간 계좌이체 창이 곧 열립니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
