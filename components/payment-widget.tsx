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
import logger from "@/lib/logger-client";

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

    // 클라이언트 키가 테스트 키인지 확인
    const isTestKey = clientKey.startsWith("test_");
    const isLiveKey = clientKey.startsWith("live_");
    
    logger.info("[PaymentWidget] 클라이언트 키 모드 확인", {
      isTestKey,
      isLiveKey,
      keyPrefix: clientKey.substring(0, 10),
    });

    if (isTestKey) {
      logger.warn("[PaymentWidget] ⚠️ 테스트 키 사용 중 - 실제 결제 불가능");
      logger.warn("[PaymentWidget] 라이브 결제를 사용하려면 클라이언트 키를 live_ck_... 형식으로 변경하세요");
    } else if (isLiveKey) {
      logger.info("[PaymentWidget] ✅ 라이브 키 사용 중 - 실제 결제 가능");
    } else {
      logger.warn("[PaymentWidget] ⚠️ 알 수 없는 키 형식:", clientKey.substring(0, 10));
    }

    logger.group("[PaymentWidget] 결제창 초기화 시작");
    logger.debug("[PaymentWidget] 주문 정보 확인", {
      hasOrderId: !!orderId,
      hasOrderName: !!orderName,
      amount: amount.toLocaleString("ko-KR") + "원",
      hasCustomerName: !!customerName,
      hasCustomerEmail: !!customerEmail,
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
          logger.error("[PaymentWidget] 필수 입력값 누락", {
            hasOrderId: !!orderId,
            hasAmount: !!amount,
            hasCustomerName: !!customerName,
            hasCustomerEmail: !!customerEmail,
            hasPaymentMethod: !!paymentMethod,
          });
          setError(errorMsg);
          alert(errorMsg);
          setTimeout(() => onClose?.(), 2000);
          logger.groupEnd();
          return;
        }

        logger.debug("[PaymentWidget] 필수 값 검증 완료", {
          hasCustomerEmail: !!customerEmail,
        });

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

        // 결제 요청 전 파라미터 검증
        const amountNumber = typeof amount === 'number' ? amount : Number(amount);
        if (isNaN(amountNumber) || amountNumber <= 0) {
          const errorMsg = `결제 금액이 올바르지 않습니다. (금액: ${amount})`;
          logger.error("[PaymentWidget] ❌ 결제 금액 검증 실패", {
            amount,
            amountNumber,
            isNaN: isNaN(amountNumber),
            isPositive: amountNumber > 0,
          });
          setError(errorMsg);
          alert(errorMsg);
          setTimeout(() => onClose?.(), 3000);
          logger.groupEnd();
          return;
        }

        if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
          const errorMsg = "주문 ID가 올바르지 않습니다.";
          logger.error("[PaymentWidget] ❌ 주문 ID 검증 실패", { orderId });
          setError(errorMsg);
          alert(errorMsg);
          setTimeout(() => onClose?.(), 3000);
          logger.groupEnd();
          return;
        }

        if (!customerEmail || !customerEmail.includes('@')) {
          const errorMsg = "고객 이메일이 올바르지 않습니다.";
          logger.error("[PaymentWidget] ❌ 고객 이메일 검증 실패", { customerEmail });
          setError(errorMsg);
          alert(errorMsg);
          setTimeout(() => onClose?.(), 3000);
          logger.groupEnd();
          return;
        }

        logger.info("[PaymentWidget] 결제 요청 파라미터 검증 완료", {
          amount: amountNumber,
          orderId,
          orderName,
          customerName,
          customerEmail,
          paymentMethod,
          isTestKey,
          isLiveKey,
        });

        // 결제 요청 객체 생성
        const paymentRequest: any = {
          method: paymentMethod === "CARD" ? "CARD" : "TRANSFER",
          amount: {
            currency: "KRW",
            value: amountNumber, // 검증된 숫자 사용
          },
          orderId: orderId.trim(), // 공백 제거
          orderName: orderName,
          customerName: customerName,
          customerEmail: customerEmail.trim(), // 공백 제거
          successUrl: successUrl,
          failUrl: failUrl,
        };

        logger.debug("[PaymentWidget] 결제 요청 객체 생성 완료", {
          method: paymentRequest.method,
          amount: paymentRequest.amount,
          hasOrderId: !!paymentRequest.orderId,
          hasOrderName: !!paymentRequest.orderName,
          orderIdLength: paymentRequest.orderId?.length,
          customerEmailLength: paymentRequest.customerEmail?.length,
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
            // 현금영수증은 선택사항이므로 제외
          };
          // 입금자명이 있으면 customerName에 설정 (실시간 계좌이체에서 입금자명으로 사용)
          if (depositorName && depositorName.trim()) {
            paymentRequest.customerName = depositorName.trim();
            logger.debug("[PaymentWidget] 입금자명 설정 완료", {
              hasDepositorName: !!depositorName,
            });
          }
          logger.debug("[PaymentWidget] 실시간 계좌이체 결제 모드", {
            useEscrow,
            hasTransfer: !!paymentRequest.transfer,
            hasCustomerName: !!paymentRequest.customerName,
          });
          logger.info("[PaymentWidget] 계좌이체 팝업창이 오버레이로 표시됩니다");
          logger.info("[PaymentWidget] 은행 선택 → 계좌번호 입력 → 인증 화면이 순서대로 표시됩니다");
        }

        logger.debug("[PaymentWidget] 결제창 호출 준비", {
          method: paymentRequest.method,
          hasOrderId: !!paymentRequest.orderId,
          hasOrderName: !!paymentRequest.orderName,
          amount: paymentRequest.amount,
          hasTransfer: !!paymentRequest.transfer,
        });

        // 결제창 호출 - 자동으로 오버레이 모달이 표시됨
        // CARD 모드: 카드사 선택 화면 → 약관 동의 → 카드 정보 입력 화면
        // TRANSFER 모드: 은행 선택 화면 → 계좌번호 입력 → 인증 화면
        logger.info("[PaymentWidget] payment.requestPayment() 호출 시작", {
          orderId: paymentRequest.orderId,
          amount: paymentRequest.amount,
          method: paymentRequest.method,
          customerEmail: paymentRequest.customerEmail,
          isTestKey,
          isLiveKey,
        });
        
        try {
          await payment.requestPayment(paymentRequest);
          logger.info("[PaymentWidget] ✅ 결제창 호출 완료 (오버레이 모달 표시됨)");
          if (paymentMethod === "TRANSFER") {
            logger.info("[PaymentWidget] 실시간 계좌이체 팝업창이 활성화되었습니다");
          }
          logger.groupEnd();
        } catch (paymentError) {
          // 결제창 호출 중 에러 발생
          logger.error("[PaymentWidget] ❌ payment.requestPayment() 에러:", paymentError);
          logger.error("[PaymentWidget] 에러 상세 정보:", {
            name: (paymentError as any)?.name,
            message: (paymentError as any)?.message,
            code: (paymentError as any)?.code,
            cause: (paymentError as any)?.cause,
            stack: (paymentError as any)?.stack,
            allProperties: Object.keys(paymentError || {}),
            paymentRequest: {
              orderId: paymentRequest.orderId,
              amount: paymentRequest.amount,
              method: paymentRequest.method,
              hasCard: !!paymentRequest.card,
              hasTransfer: !!paymentRequest.transfer,
            },
            clientKey: {
              prefix: clientKey?.substring(0, 20),
              isTestKey,
              isLiveKey,
            },
          });
          throw paymentError; // 상위 catch 블록에서 처리
        }
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
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
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

  // 결제창이 열리는 동안 로딩 표시 (배경 없이)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg pointer-events-auto">
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
