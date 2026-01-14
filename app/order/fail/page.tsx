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
  const code = searchParams.get("code");

  // 에러 코드별 안내 메시지
  const getErrorMessage = () => {
    if (code === "2003") {
      return "업체 사정으로 인해 일시적으로 결제가 불가능합니다. 잠시 후 다시 시도해주세요.";
    }
    return message;
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-red-600 mb-4">
          <XCircle className="w-16 h-16 mx-auto" />
        </div>
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-4">
          결제에 실패했습니다
        </h1>
        <p className="text-[#8b7d84] mb-4">{getErrorMessage()}</p>
        
        {code && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-600">
              오류 코드: {code}
            </p>
          </div>
        )}

        <div className="bg-[#ffeef5] rounded-xl p-4 text-left mb-6">
          <p className="text-sm text-[#4a3f48] mb-2">
            <strong>결제 실패 시 확인사항:</strong>
          </p>
          <ul className="text-xs text-[#8b7d84] space-y-1 list-disc list-inside">
            <li>카드 한도 및 잔액 확인</li>
            <li>카드 정보 입력 확인</li>
            <li>인터넷 연결 상태 확인</li>
            <li>잠시 후 다시 시도</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => router.push("/checkout")}
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

