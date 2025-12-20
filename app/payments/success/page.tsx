/**
 * @file app/payments/success/page.tsx
 * @description 결제 완료 페이지
 *
 * 주요 기능:
 * 1. 결제 성공 정보 표시
 * 2. 주문 내역 링크 제공
 */

import { Suspense } from "react";
import PaymentSuccessContent from "@/components/payment-success-content";

// 동적 렌더링 강제 (useSearchParams 사용으로 인해 정적 생성 불가)
export const dynamic = "force-dynamic";

export default function PaymentSuccessPage() {
  return (
    <main className="py-8">
      <div className="shop-container max-w-2xl mx-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
                <p className="text-sm text-[#8b7d84]">결제 정보를 불러오는 중...</p>
              </div>
            </div>
          }
        >
          <PaymentSuccessContent />
        </Suspense>
      </div>
    </main>
  );
}

