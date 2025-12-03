/**
 * @file app/payments/fail/page.tsx
 * @description 결제 실패 페이지
 */

import { Suspense } from "react";
import PaymentFailContent from "@/components/payment-fail-content";

// 동적 렌더링 강제 (useSearchParams 사용으로 인해 정적 생성 불가)
export const dynamic = "force-dynamic";

export default function PaymentFailPage() {
  return (
    <main className="py-8">
      <div className="shop-container max-w-2xl mx-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d] mx-auto mb-4"></div>
                <p className="text-sm text-[#8b7d84]">
                  결제 정보를 불러오는 중...
                </p>
              </div>
            </div>
          }
        >
          <PaymentFailContent />
        </Suspense>
      </div>
    </main>
  );
}

