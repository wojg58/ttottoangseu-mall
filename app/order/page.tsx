/**
 * @file app/order/page.tsx
 * @description 주문/결제 페이지
 * 
 * 주요 기능:
 * 1. 결제수단 선택 (신용카드/계좌이체)
 * 2. 결제금액 표시
 * 3. 결제하기 버튼 클릭 시 prepare API 호출 후 결제위젯 모달 표시
 * 
 * @dependencies
 * - @tosspayments/payment-widget-sdk: 결제위젯 SDK
 * - @/actions/cart: 장바구니 조회
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PaymentWidgetInstance,
  loadPaymentWidget,
} from "@tosspayments/payment-widget-sdk";
import { Button } from "@/components/ui/button";
import { getCartItems } from "@/actions/cart";
import logger from "@/lib/logger";

type PaymentMethod = "CARD" | "TRANSFER";

export default function OrderPage() {
  const router = useRouter();
  const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null
  );
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWidgetReady, setIsWidgetReady] = useState(false);

  // 결제위젯 초기화 및 장바구니 금액 계산
  useEffect(() => {
    logger.group("[OrderPage] 결제위젯 초기화 시작");

    const initializePaymentWidget = async () => {
      try {
        // 클라이언트 키 확인
        const clientKey =
          process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ||
          process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY;

        logger.info("클라이언트 키 확인:", {
          exists: !!clientKey,
          startsWithTest: clientKey?.startsWith("test_"),
        });

        if (!clientKey) {
          throw new Error("TossPayments 클라이언트 키가 설정되지 않았습니다.");
        }

        // customerKey 생성 (이메일 기반)
        // 임시로 사용자 ID 기반으로 생성 (실제로는 사용자 이메일 사용)
        const customerKey = `customer_${Date.now()}`;

        logger.info("결제위젯 로드 시작", {
          clientKeyPrefix: clientKey.substring(0, 10) + "...",
          customerKey,
        });

        const paymentWidget = await loadPaymentWidget(clientKey, customerKey);
        paymentWidgetRef.current = paymentWidget;

        logger.info("✅ 결제위젯 인스턴스 생성 완료");

        // 장바구니에서 금액 계산 (서버와 동일한 로직 사용)
        try {
          const cartItems = await getCartItems();
          
          // 서버와 동일한 로직으로 금액 계산
          let subtotal = 0;
          for (const item of cartItems) {
            // discount_price가 있으면 우선 사용, 없으면 price 사용
            const basePrice = item.product.discount_price ?? item.product.price;
            // variant의 price_adjustment 고려
            const adjustment = item.variant?.price_adjustment ?? 0;
            const itemPrice = basePrice + adjustment;
            subtotal += itemPrice * item.quantity;
          }
          
          const shippingFee = subtotal >= 50000 ? 0 : 3000;
          const total = subtotal + shippingFee;

          setTotalAmount(total);

          logger.info("장바구니 금액 계산 완료 (서버 로직과 동일):", {
            subtotal,
            shippingFee,
            total,
          });
        } catch (cartError) {
          logger.warn("장바구니 조회 실패 (표시용이므로 계속 진행):", cartError);
          // 장바구니 조회 실패해도 결제는 가능 (서버에서 재계산)
        }

        setIsLoading(false);
        setIsWidgetReady(true);

        logger.info("✅ 결제위젯 초기화 완료");
        logger.groupEnd();
      } catch (err) {
        logger.error("❌ 결제위젯 초기화 에러:", err);
        setError(
          err instanceof Error
            ? err.message
            : "결제 위젯 초기화에 실패했습니다."
        );
        setIsLoading(false);
        logger.groupEnd();
      }
    };

    initializePaymentWidget();
  }, []);

  // 결제하기 버튼 클릭 핸들러
  const handlePayment = async () => {
    logger.group("[OrderPage] 결제하기 버튼 클릭");

    if (!paymentMethod) {
      logger.warn("결제수단 미선택");
      alert("결제수단을 선택해주세요.");
      logger.groupEnd();
      return;
    }

    if (!paymentWidgetRef.current) {
      logger.error("결제위젯이 초기화되지 않음");
      alert("결제 위젯을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      logger.groupEnd();
      return;
    }

    if (isProcessing) {
      logger.warn("이미 결제 처리 중");
      logger.groupEnd();
      return;
    }

    setIsProcessing(true);

    try {
      // 1. prepare API 호출
      logger.info("prepare API 호출 시작");
      const prepareResponse = await fetch("/api/payments/toss/prepare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: totalAmount,
        }),
      });

      const prepareData = await prepareResponse.json();

      if (!prepareResponse.ok || !prepareData.success) {
        logger.error("prepare API 실패:", prepareData);
        throw new Error(prepareData.message || "결제 준비에 실패했습니다.");
      }

      logger.info("✅ prepare API 성공:", {
        orderId: prepareData.orderId,
        amount: prepareData.amount,
        orderName: prepareData.orderName,
      });

      const { orderId, amount, orderName, customerName, customerEmail } =
        prepareData;

      // 2. BASE_URL 가져오기
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;

      // 3. 결제수단에 따라 requestPayment 호출
      const successUrl = `${baseUrl}/order/success`;
      const failUrl = `${baseUrl}/order/fail`;

      const paymentRequest: any = {
        orderId,
        orderName,
        customerName,
        customerEmail,
        // 결제 금액 설정 (서버에서 계산한 정확한 금액 사용)
        amount: {
          currency: "KRW",
          value: amount,
        },
        successUrl: `${successUrl}?paymentKey={paymentKey}&orderId=${orderId}&amount=${amount}`,
        failUrl: `${failUrl}?message={message}`,
        // 모달/오버레이 형태로 열리도록 설정
        windowTarget: "iframe", // PC 환경에서 iframe으로 열림 (모달 형태)
      };

      // 결제수단 설정
      if (paymentMethod === "CARD") {
        paymentRequest.method = "CARD";
        paymentRequest.card = {
          useEscrow: false,
          flowMode: "DIRECT", // 자체창 바로 열기 (카드사 선택/카드번호 입력 화면)
          useCardPoint: false,
          useAppCardOnly: false,
        };
        logger.info("신용카드 결제 요청 (DIRECT 모드)");
      } else if (paymentMethod === "TRANSFER") {
        paymentRequest.method = "TRANSFER";
        paymentRequest.transfer = {
          useEscrow: true, // 에스크로 계좌이체
        };
        logger.info("에스크로 계좌이체 결제 요청");
      }

      logger.info("requestPayment 호출:", {
        orderId: paymentRequest.orderId,
        method: paymentRequest.method,
        windowTarget: paymentRequest.windowTarget,
        successUrl: paymentRequest.successUrl,
        failUrl: paymentRequest.failUrl,
      });

      // 4. 결제 요청 (모달이 자동으로 열림)
      // requestPayment를 호출하면 결제위젯이 모달/오버레이 형태로 열림
      await paymentWidgetRef.current.requestPayment(paymentRequest);

      logger.info("✅ requestPayment 호출 완료 (리다이렉트 예정)");
      logger.groupEnd();
    } catch (err) {
      logger.error("❌ 결제 처리 에러:", err);
      const errorMessage =
        err instanceof Error ? err.message : "결제 처리에 실패했습니다.";
      alert(errorMessage);
      setIsProcessing(false);
      logger.groupEnd();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-sm text-[#8b7d84]">결제 위젯을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            새로고침
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="py-8">
      <div className="shop-container max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-8">주문/결제</h1>

        {/* 결제수단 선택 */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-[#4a3f48]">결제수단</h2>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer p-4 border border-[#f5d5e3] rounded-lg hover:bg-[#fef8fb] transition-colors">
              <input
                type="radio"
                name="paymentMethod"
                value="CARD"
                checked={paymentMethod === "CARD"}
                onChange={(e) => {
                  logger.info("결제수단 선택: 신용카드");
                  setPaymentMethod(e.target.value as PaymentMethod);
                }}
                className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
              />
              <span className="text-sm text-[#4a3f48] font-medium">
                신용카드 결제
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer p-4 border border-[#f5d5e3] rounded-lg hover:bg-[#fef8fb] transition-colors">
              <input
                type="radio"
                name="paymentMethod"
                value="TRANSFER"
                checked={paymentMethod === "TRANSFER"}
                onChange={(e) => {
                  logger.info("결제수단 선택: 에스크로 계좌이체");
                  setPaymentMethod(e.target.value as PaymentMethod);
                }}
                className="w-4 h-4 text-[#ff6b9d] border-[#f5d5e3] focus:ring-[#ff6b9d]"
              />
              <span className="text-sm text-[#4a3f48] font-medium">
                에스크로(계좌이체)
              </span>
            </label>
          </div>
        </div>

        {/* 결제금액 표시 */}
        <div className="border-t border-[#f5d5e3] pt-4 mb-8">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-[#4a3f48]">
              결제금액
            </span>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#ff6b9d]">
                {totalAmount.toLocaleString("ko-KR")}
                <span className="text-base">원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 결제하기 버튼 */}
        <Button
          onClick={handlePayment}
          disabled={!isWidgetReady || !paymentMethod || isProcessing}
          className="w-full h-14 bg-[#ff6b9d] hover:bg-[#ff5088] text-white rounded-xl text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-8"
        >
          {isProcessing
            ? "결제 처리 중..."
            : !isWidgetReady
            ? "결제위젯 로딩 중..."
            : !paymentMethod
            ? "결제 수단을 선택해주세요"
            : "결제하기"}
        </Button>
      </div>
    </main>
  );
}

