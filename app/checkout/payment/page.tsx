/**
 * @file app/checkout/payment/page.tsx
 * @description 결제 전용 페이지
 * 
 * TossPayments 결제창을 새 페이지에서 표시합니다.
 */

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PaymentWidget from "@/components/payment-widget";
import logger from "@/lib/logger";

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);

  // URL 파라미터에서 결제 정보 추출
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const orderName = searchParams.get("orderName");
  const customerName = searchParams.get("customerName");
  const customerEmail = searchParams.get("customerEmail");
  const paymentMethod = searchParams.get("paymentMethod") as "CARD" | "TRANSFER" | null;
  const depositorName = searchParams.get("depositorName") || undefined;
  const useEscrow = searchParams.get("useEscrow") === "true";

  useEffect(() => {
    logger.group("[PaymentPage] 결제 페이지 초기화");
    logger.info("URL 파라미터:", {
      orderId,
      amount,
      orderName,
      customerName,
      customerEmail,
      paymentMethod,
      depositorName,
      useEscrow,
    });

    // 필수 파라미터 검증
    if (!orderId || !amount || !orderName || !customerName || !customerEmail || !paymentMethod) {
      logger.error("[PaymentPage] ❌ 필수 파라미터 누락", {
        hasOrderId: !!orderId,
        hasAmount: !!amount,
        hasOrderName: !!orderName,
        hasCustomerName: !!customerName,
        hasCustomerEmail: !!customerEmail,
        hasPaymentMethod: !!paymentMethod,
      });
      alert("결제 정보가 올바르지 않습니다. 주문/결제 페이지로 돌아갑니다.");
      router.push("/checkout");
      logger.groupEnd();
      return;
    }

    // 금액 검증
    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      logger.error("[PaymentPage] ❌ 잘못된 금액:", {
        amount,
        amountNumber,
        isNaN: isNaN(amountNumber),
        isPositive: amountNumber > 0,
      });
      alert("결제 금액이 올바르지 않습니다. 주문/결제 페이지로 돌아갑니다.");
      router.push("/checkout");
      logger.groupEnd();
      return;
    }

    // 이메일 검증
    if (!customerEmail.includes('@')) {
      logger.error("[PaymentPage] ❌ 잘못된 이메일:", customerEmail);
      alert("고객 이메일이 올바르지 않습니다. 주문/결제 페이지로 돌아갑니다.");
      router.push("/checkout");
      logger.groupEnd();
      return;
    }

    // 결제 수단 검증
    if (paymentMethod !== "CARD" && paymentMethod !== "TRANSFER") {
      logger.error("[PaymentPage] ❌ 잘못된 결제 수단:", paymentMethod);
      alert("결제 수단이 올바르지 않습니다. 주문/결제 페이지로 돌아갑니다.");
      router.push("/checkout");
      logger.groupEnd();
      return;
    }

    logger.info("[PaymentPage] ✅ 파라미터 검증 완료", {
      orderId,
      amount: amountNumber,
      orderName,
      customerName,
      customerEmail,
      paymentMethod,
    });
    setIsReady(true);
    logger.groupEnd();
  }, [orderId, amount, orderName, customerName, customerEmail, paymentMethod, depositorName, useEscrow, router]);

  // 결제창 닫기 핸들러
  const handleClose = () => {
    logger.info("[PaymentPage] 결제창 닫기 - 주문/결제 페이지로 이동");
    router.push("/checkout");
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
          <p className="text-base font-medium text-[#4a3f48]">결제 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PaymentWidget
        orderId={orderId!}
        amount={Number(amount)}
        orderName={orderName!}
        customerName={customerName!}
        customerEmail={customerEmail!}
        paymentMethod={paymentMethod!}
        depositorName={depositorName}
        useEscrow={useEscrow}
        onClose={handleClose}
      />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
            <p className="text-base font-medium text-[#4a3f48]">결제 정보를 불러오는 중...</p>
          </div>
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}

