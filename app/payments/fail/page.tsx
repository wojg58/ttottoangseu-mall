/**
 * @file app/payments/fail/page.tsx
 * @description 결제 실패 안내 페이지
 * 
 * 결제 인증 실패 또는 승인 실패 시 표시되는 페이지
 */

import Link from "next/link";
import { XCircle, Home, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchParams {
  message?: string;
  code?: string;
}

interface PaymentFailPageProps {
  searchParams: Promise<SearchParams>;
}

export default async function PaymentFailPage({
  searchParams,
}: PaymentFailPageProps) {
  const params = await searchParams;
  const message = params.message || "결제에 실패했습니다.";
  const code = params.code;

  console.group("[PaymentFailPage] 결제 실패 페이지");
  console.log("에러 메시지:", message);
  console.log("에러 코드:", code);
  console.groupEnd();

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#ffeef5] py-12 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {/* 에러 아이콘 */}
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
          결제 실패
        </h1>
        
        <p className="text-[#8b7d84] mb-6">
          {message}
        </p>

        {code && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-600">
              오류 코드: {code}
            </p>
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="bg-[#ffeef5] rounded-xl p-4 text-left mb-8">
          <p className="text-sm text-[#4a3f48] mb-2">
            <strong>결제가 실패한 이유:</strong>
          </p>
          <ul className="text-xs text-[#8b7d84] space-y-1 list-disc list-inside">
            <li>카드 한도 초과</li>
            <li>잘못된 카드 정보 입력</li>
            <li>본인 인증 실패</li>
            <li>결제 취소</li>
            <li>시스템 오류</li>
          </ul>
        </div>

        {/* 버튼들 */}
        <div className="flex flex-col gap-3">
          <Link href="/checkout" className="w-full">
            <Button className="w-full h-12 bg-[#ff6b9d] hover:bg-[#ff5088] text-white">
              <ShoppingCart className="w-4 h-4 mr-2" />
              다시 결제하기
            </Button>
          </Link>
          
          <Link href="/" className="w-full">
            <Button
              variant="outline"
              className="w-full h-12 border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
            >
              <Home className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </Button>
          </Link>
        </div>

        {/* 고객센터 안내 */}
        <div className="mt-6 pt-6 border-t border-[#f5d5e3]">
          <p className="text-xs text-[#8b7d84]">
            문제가 계속되면 고객센터(1544-7772)로 문의해주세요.
          </p>
        </div>
      </div>
    </main>
  );
}
