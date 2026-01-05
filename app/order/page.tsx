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
  const [paymentMethodsWidget, setPaymentMethodsWidget] = useState<any>(null);
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

        // 장바구니에서 금액 계산 (표시용, 실제 금액은 서버에서 검증)
        try {
          const cartItems = await getCartItems();
          const subtotal = cartItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          const shippingFee = subtotal >= 50000 ? 0 : 3000;
          const total = subtotal + shippingFee;

          setTotalAmount(total);

          logger.info("장바구니 금액 계산 완료:", {
            subtotal,
            shippingFee,
            total,
          });

          // 결제위젯 UI를 미리 렌더링 (금액은 임시로 설정, 나중에 업데이트)
          const container = document.getElementById("payment-methods");
          if (container) {
            const widget = paymentWidgetRef.current.renderPaymentMethods(
              "#payment-methods",
              { value: total }
            );
            setPaymentMethodsWidget(widget);

            // 위젯이 준비되면 이벤트 리스너 등록
            widget.on("ready", () => {
              logger.info("✅ 결제위젯 UI 렌더링 완료");
              setIsWidgetReady(true);
            });

            // 결제수단 선택 이벤트 리스너
            widget.on("paymentMethodSelect", (selectedPaymentMethod: any) => {
              logger.info("결제수단 선택됨 (위젯 내부):", selectedPaymentMethod);
              // 위젯 내에서 선택된 결제수단에 따라 상태 업데이트
              if (selectedPaymentMethod.code === "카드") {
                setPaymentMethod("CARD");
              } else if (selectedPaymentMethod.code === "계좌이체") {
                setPaymentMethod("TRANSFER");
              }
            });
          }
        } catch (cartError) {
          logger.warn("장바구니 조회 실패 (표시용이므로 계속 진행):", cartError);
          // 장바구니 조회 실패해도 결제는 가능 (서버에서 재계산)
        }

        setIsLoading(false);

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

      // 3. 결제위젯 금액 업데이트
      logger.info("결제위젯 금액 업데이트 시작");
      
      // 결제위젯이 이미 렌더링되어 있다면 금액만 업데이트
      if (paymentMethodsWidget) {
        // 금액 업데이트 (updateAmount 메서드가 있다면 사용)
        try {
          if (typeof paymentMethodsWidget.updateAmount === "function") {
            paymentMethodsWidget.updateAmount({ value: amount });
            logger.info("✅ 결제위젯 금액 업데이트 완료");
          } else {
            // updateAmount가 없다면 다시 렌더링
            paymentMethodsWidget.destroy?.();
            const widget = paymentWidgetRef.current.renderPaymentMethods(
              "#payment-methods",
              { value: amount }
            );
            setPaymentMethodsWidget(widget);
            logger.info("✅ 결제위젯 재렌더링 완료");
          }
        } catch (updateError) {
          logger.warn("금액 업데이트 실패, 재렌더링 시도:", updateError);
          // 재렌더링
          if (paymentMethodsWidget.destroy) {
            await paymentMethodsWidget.destroy();
          }
          const widget = paymentWidgetRef.current.renderPaymentMethods(
            "#payment-methods",
            { value: amount }
          );
          setPaymentMethodsWidget(widget);
        }
      } else {
        // 결제위젯이 렌더링되지 않았다면 렌더링
        const container = document.getElementById("payment-methods");
        if (!container) {
          const newContainer = document.createElement("div");
          newContainer.id = "payment-methods";
          document.body.appendChild(newContainer);
        }
        const widget = paymentWidgetRef.current.renderPaymentMethods(
          "#payment-methods",
          { value: amount }
        );
        setPaymentMethodsWidget(widget);
        logger.info("✅ 결제위젯 렌더링 완료");
      }

      // 4. 위젯이 준비될 때까지 대기
      if (!isWidgetReady && paymentMethodsWidget) {
        logger.info("결제위젯 준비 대기 중...");
        // 위젯이 준비될 때까지 잠시 대기
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 5. 결제수단에 따라 requestPayment 호출
      const successUrl = `${baseUrl}/order/success`;
      const failUrl = `${baseUrl}/order/fail`;

      const paymentRequest: any = {
        orderId,
        orderName,
        customerName,
        customerEmail,
        successUrl: `${successUrl}?paymentKey={paymentKey}&orderId=${orderId}&amount=${amount}`,
        failUrl: `${failUrl}?message={message}`,
      };

      // 결제수단 설정 (위젯 내에서 선택된 결제수단 사용)
      // 위젯 내에서 선택되지 않았다면 method를 지정
      if (paymentMethod === "CARD") {
        paymentRequest.method = "카드";
        logger.info("신용카드 결제 요청");
      } else if (paymentMethod === "TRANSFER") {
        paymentRequest.method = "계좌이체";
        logger.info("계좌이체 결제 요청");
      }

      logger.info("requestPayment 호출:", {
        orderId: paymentRequest.orderId,
        method: paymentRequest.method,
        successUrl: paymentRequest.successUrl,
        failUrl: paymentRequest.failUrl,
      });

      // 6. 결제 요청 (모달이 자동으로 열림)
      // 위젯 내에서 결제수단이 선택되지 않았어도 method를 지정하면 진행 가능
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

        {/* 결제수단 선택 안내 */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-[#4a3f48]">결제수단</h2>
          <p className="text-sm text-[#8b7d84]">
            아래에서 결제수단을 선택해주세요.
          </p>
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

        {/* 결제위젯 렌더링 영역 (표시) */}
        <div id="payment-methods" className="mt-4"></div>

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

