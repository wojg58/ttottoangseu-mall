/**
 * @file app/order/fail/page.tsx
 * @description 결제 실패 페이지
 * 
 * 주요 기능:
 * 1. 쿼리 파라미터에서 에러 메시지 받기
 * 2. 실패 UI 표시
 * 
 * @dependencies
 * - next/navigation: 쿼리 파라미터 처리
 */

"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

function OrderFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const message = searchParams.get("message") || "결제에 실패했습니다.";

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-red-600 mb-4">
          <XCircle className="w-16 h-16 mx-auto" />
        </div>
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-4">
          결제에 실패했습니다
        </h1>
        <p className="text-[#8b7d84] mb-8">{message}</p>
        <div className="space-y-2">
          <Button
            onClick={() => router.push("/order")}
            className="w-full bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
          >
            다시 시도
          </Button>
          <Button
            onClick={() => router.push("/cart")}
            variant="outline"
            className="w-full border-[#f5d5e3] text-[#4a3f48] hover:bg-[#fef8fb]"
          >
            장바구니로 가기
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OrderFailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">로딩 중...</div>
      </div>
    }>
      <OrderFailContent />
    </Suspense>
  );
}

