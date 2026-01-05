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
  const [paymentMethod, setPaymentMethod] = useState<"카드" | "계좌이체" | null>(null);
  const [depositorName, setDepositorName] = useState("");
  const [useEscrow, setUseEscrow] = useState(false);
  const [cashReceipt, setCashReceipt] = useState<"신청" | "신청안함">("신청안함");

  useEffect(() => {
    logger.group("[PaymentWidget] 결제 위젯 초기화 시작");
    logger.debug("주문 정보:", {
      orderId,
      orderNumber,
      amount: amount.toLocaleString("ko-KR") + "원",
      customerName,
      customerEmail,
    });

    const initializePaymentWidget = async () => {
      try {
        // 클라이언트 키는 환경 변수에서 가져옴
        const clientKey = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;
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
  }, [orderId, orderNumber, amount, customerEmail, customerName]);

  const handlePayment = async () => {
    logger.group("[PaymentWidget] 결제 요청 시작");
    logger.debug("결제 정보:", {
      orderId,
      orderNumber,
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
    if (paymentMethod === "계좌이체" && !depositorName.trim()) {
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

    try {
      // 필수 값 검증
      if (!orderId || !orderNumber || !amount || !customerName || !customerEmail) {
        logger.error("[PaymentWidget] ❌ 필수 입력값 누락:", {
          orderId: !!orderId,
          orderNumber: !!orderNumber,
          amount: !!amount,
          customerName: !!customerName,
          customerEmail: !!customerEmail,
        });
        alert("결제 정보가 불완전합니다. 페이지를 새로고침해주세요.");
        logger.groupEnd();
        return;
      }

      logger.info("[PaymentWidget] 결제 요청 API 호출 시작", {
        orderId,
        orderNumber,
        amount,
        customerName: customerName.substring(0, 1) + "***",
        customerEmail: customerEmail.substring(0, 3) + "***",
      });
      
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
        logger.error("[PaymentWidget] ❌ 결제 요청 API 실패:", data);
        throw new Error(data.message || "결제 요청에 실패했습니다.");
      }

      logger.debug("[PaymentWidget] ✅ 결제 요청 API 성공:", {
        paymentId: data.paymentId,
        orderId: data.orderId,
      });

      // 결제 위젯 실행 (TossPayments 위젯이 자동으로 결제 처리)
      // orderId는 원래 주문 ID를 사용해야 함 (paymentId가 아님)
      const paymentRequest: any = {
        orderId: orderId, // 원래 주문 ID 사용
        orderName: `주문번호: ${orderNumber}`,
        customerName,
        customerEmail,
        successUrl: `${window.location.origin}/payments/success?paymentKey={paymentKey}&orderId=${orderId}&amount=${amount}`,
        failUrl: `${window.location.origin}/payments/fail?message={message}`,
        flowMode: "DIRECT" as const, // 결제창 바로 열기
      };

      // 결제수단에 따라 method 지정
      if (paymentMethod === "카드") {
        // 신용카드 결제
        paymentRequest.method = "카드";
        // 간편결제 옵션 (토스페이 등)
        paymentRequest.easyPay = "토스페이";
      } else if (paymentMethod === "계좌이체") {
        // 실시간 계좌이체 (퀵계좌이체)
        paymentRequest.method = "계좌이체";
        paymentRequest.transfer = {
          cashReceipt: {
            type: cashReceipt === "신청" ? "소득공제" : undefined,
          },
          useEscrow: useEscrow,
        };
        // 입금자명이 있으면 추가
        if (depositorName.trim()) {
          paymentRequest.customerName = depositorName.trim();
        }
      }

      logger.info("[PaymentWidget] TossPayments 결제 위젯 실행:", {
        orderId: paymentRequest.orderId,
        orderName: paymentRequest.orderName,
        paymentMethod,
        method: paymentRequest.method,
        easyPay: paymentRequest.easyPay,
        transfer: paymentRequest.transfer,
        successUrl: paymentRequest.successUrl,
        failUrl: paymentRequest.failUrl,
      });
      
      try {
        logger.debug("[PaymentWidget] requestPayment 호출 직전");
        const result = await paymentWidgetRef.current.requestPayment(paymentRequest);
        logger.debug("[PaymentWidget] ✅ requestPayment 성공 (리다이렉트 예정):", result);
        // requestPayment는 Promise를 반환하지만, 실제로는 결제 페이지로 리다이렉트되므로
        // 여기까지 도달하는 경우는 드뭅니다.
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

  // 에러가 있어도 결제 위젯 UI는 표시 (에러 메시지와 함께)
  if (error) {
    logger.warn("[PaymentWidget] 에러 발생했지만 UI는 표시:", error);
  }

  return (
    <div className="space-y-6">
      {/* 에러 메시지 표시 (있을 경우) */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-red-500 mt-2">
            ⚠️ 결제 위젯 초기화에 문제가 있습니다. 페이지를 새로고침해주세요.
          </p>
        </div>
      )}
      
      {/* 결제 수단 선택 */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-[#4a3f48]">결제수단</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 border border-[#f5d5e3] rounded-lg hover:bg-[#fef8fb] transition-colors">
            <input
              type="radio"
              name="paymentMethod"
              value="카드"
              checked={paymentMethod === "카드"}
              onChange={(e) => {
                logger.info("[PaymentWidget] 결제수단 선택: 신용카드");
                setPaymentMethod(e.target.value as "카드");
                logger.info("[PaymentWidget] paymentMethod 상태 업데이트:", e.target.value);
              }}
              className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
            />
            <span className="text-sm text-[#4a3f48] font-medium">신용카드 결제</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer p-3 border border-[#f5d5e3] rounded-lg hover:bg-[#fef8fb] transition-colors">
            <input
              type="radio"
              name="paymentMethod"
              value="계좌이체"
              checked={paymentMethod === "계좌이체"}
              onChange={(e) => {
                logger.info("[PaymentWidget] 결제수단 선택: 에스크로(실시간 계좌이체)");
                setPaymentMethod(e.target.value as "계좌이체");
                logger.info("[PaymentWidget] paymentMethod 상태 업데이트:", e.target.value);
              }}
              className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
            />
            <span className="text-sm text-[#4a3f48] font-medium">에스크로(실시간 계좌이체)</span>
          </label>
        </div>
      </div>

      {/* 계좌이체 선택 시 추가 입력 필드 */}
      {paymentMethod === "계좌이체" && (
        <div className="space-y-4">
          {/* 입금자명 */}
          <div>
            <label className="block text-sm font-medium text-[#4a3f48] mb-2">
              예금주명
            </label>
            <input
              type="text"
              value={depositorName}
              onChange={(e) => {
                logger.debug("[PaymentWidget] 입금자명 입력:", e.target.value.substring(0, 1) + "***");
                setDepositorName(e.target.value);
              }}
              placeholder=""
              className="w-full px-3 py-2 border border-[#d4d4d4] rounded text-sm focus:outline-none focus:border-[#ff6b9d] focus:ring-1 focus:ring-[#ff6b9d]"
            />
          </div>

          {/* 에스크로 서비스 체크박스 */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="escrow"
              checked={useEscrow}
              onChange={(e) => {
                logger.debug("[PaymentWidget] 에스크로 서비스:", e.target.checked ? "적용" : "미적용");
                setUseEscrow(e.target.checked);
              }}
              className="w-4 h-4 text-[#ff6b9d] border-[#d4d4d4] rounded focus:ring-[#ff6b9d] mt-0.5"
            />
            <label htmlFor="escrow" className="text-xs text-[#4a3f48] cursor-pointer">
              에스크로(구매안전) 서비스를 적용합니다.
            </label>
          </div>

          {/* 경고 메시지 */}
          <div className="bg-[#fff5f5] border border-[#fad2e6] rounded p-3">
            <p className="text-xs text-[#ff6b9d] leading-relaxed">
              ⚠️ 소액 결제의 경우 PG사 정책에 따라 관련 금융 결제 수단이 인증 후 사용이 가능합니다.
            </p>
          </div>

          {/* 현금영수증 신청 옵션 */}
          <div>
            <h4 className="text-sm font-medium text-[#4a3f48] mb-3">현금영수증 신청</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cashReceipt"
                  value="신청"
                  checked={cashReceipt === "신청"}
                  onChange={(e) => {
                    logger.debug("[PaymentWidget] 현금영수증: 신청");
                    setCashReceipt(e.target.value as "신청");
                  }}
                  className="w-4 h-4 text-[#ff6b9d] border-[#d4d4d4] focus:ring-[#ff6b9d]"
                />
                <span className="text-sm text-[#4a3f48]">현금영수증신청</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cashReceipt"
                  value="신청안함"
                  checked={cashReceipt === "신청안함"}
                  onChange={(e) => {
                    logger.debug("[PaymentWidget] 현금영수증: 신청안함");
                    setCashReceipt(e.target.value as "신청안함");
                  }}
                  className="w-4 h-4 text-[#ff6b9d] border-[#d4d4d4] focus:ring-[#ff6b9d]"
                />
                <span className="text-sm text-[#4a3f48]">신청안함</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 신용카드 결제 선택 시에만 최종 금액 표시 */}
      {paymentMethod === "카드" && (
        <>
          <div className="border-t border-[#f5d5e3] pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#8b7d84]">카드 결제 최종결제 금액</span>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#ff6b9d]">
                  {amount.toLocaleString("ko-KR")}
                  <span className="text-base">원</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#8b7d84] text-center">
            결제하기 버튼을 클릭하면 토스페이먼츠 결제창이 열립니다.
          </p>
        </>
      )}

      {/* 결제 버튼 */}
      <Button
        onClick={() => {
          logger.info("[PaymentWidget] 결제하기 버튼 클릭", {
            isLoading,
            paymentMethod,
            depositorName: paymentMethod === "계좌이체" ? depositorName : "N/A",
            disabled: isLoading || !paymentMethod || (paymentMethod === "계좌이체" && !depositorName.trim()),
          });
          handlePayment();
        }}
        disabled={
          isLoading || 
          !paymentMethod || 
          (paymentMethod === "계좌이체" && !depositorName.trim())
        }
        className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!paymentMethod 
          ? "결제 수단을 선택해주세요" 
          : paymentMethod === "계좌이체" && !depositorName.trim()
          ? "예금주명을 입력해주세요"
          : "결제하기"}
      </Button>
    </div>
  );
}
