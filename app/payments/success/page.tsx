/**
 * @file app/payments/success/page.tsx
 * @description 결제 성공 처리 페이지
 * 
 * 토스페이먼츠 결제 인증 성공 후 리다이렉트되는 페이지
 * 1. 결제 승인 API 호출
 * 2. 결과에 따라 주문 완료 페이지로 이동 또는 에러 표시
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { confirmPayment } from "@/actions/payments";

interface SearchParams {
  paymentKey?: string;
  orderId?: string;
  amount?: string;
}

interface PaymentSuccessPageProps {
  searchParams: Promise<SearchParams>;
}

// 실제 결제 처리 컴포넌트
async function PaymentSuccessHandler({ searchParams }: PaymentSuccessPageProps) {
  const params = await searchParams;
  const { paymentKey, orderId, amount } = params;

  console.group("[PaymentSuccessPage] 결제 성공 페이지 진입");
  console.log("paymentKey:", paymentKey);
  console.log("orderId:", orderId);
  console.log("amount:", amount);
  console.groupEnd();

  // 필수 파라미터 검증
  if (!paymentKey || !orderId || !amount) {
    console.error("[PaymentSuccessPage] ❌ 필수 파라미터 누락");
    redirect("/payments/fail?message=잘못된 결제 요청입니다.");
  }

  const amountNumber = parseInt(amount, 10);
  if (isNaN(amountNumber)) {
    console.error("[PaymentSuccessPage] ❌ 잘못된 금액 형식:", amount);
    redirect("/payments/fail?message=잘못된 결제 금액입니다.");
  }

  // 결제 승인 처리
  console.log("[PaymentSuccessPage] 결제 승인 처리 시작...");
  const result = await confirmPayment({
    paymentKey,
    orderId,
    amount: amountNumber,
  });

  console.group("[PaymentSuccessPage] 결제 승인 결과");
  console.log("성공 여부:", result.success);
  console.log("메시지:", result.message);
  if (result.orderId) {
    console.log("주문번호:", result.orderId);
  }
  console.groupEnd();

  // 결과에 따라 리다이렉트
  if (result.success) {
    console.log("[PaymentSuccessPage] ✅ 결제 완료 - 주문 완료 페이지로 이동");
    redirect(`/checkout/complete?orderId=${orderId}`);
  } else {
    console.error("[PaymentSuccessPage] ❌ 결제 승인 실패:", result.message);
    redirect(`/payments/fail?message=${encodeURIComponent(result.message)}`);
  }
}

// 로딩 컴포넌트
function PaymentProcessing() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#ffeef5]">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ff6b9d]"></div>
        </div>
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
          결제 처리 중입니다
        </h1>
        <p className="text-[#8b7d84] mb-4">
          잠시만 기다려주세요...
        </p>
        <p className="text-xs text-[#ff6b9d]">
          ⚠️ 페이지를 닫거나 새로고침하지 마세요.
        </p>
      </div>
    </main>
  );
}

// 메인 페이지 컴포넌트
export default function PaymentSuccessPage(props: PaymentSuccessPageProps) {
  return (
    <Suspense fallback={<PaymentProcessing />}>
      <PaymentSuccessHandler {...props} />
    </Suspense>
  );
}
