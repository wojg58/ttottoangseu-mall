/**
 * @file app/sign-up/complete/page.tsx
 * @description 회원가입 완료 페이지
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function SignUpCompletePage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold mb-4">회원가입 완료!</h1>

          <p className="text-gray-600 mb-2">
            또또앙스의 회원이 되신 것을 환영합니다! 🎉
          </p>

          <p className="text-gray-600 mb-8">
            다양한 혜택과 귀여운 굿즈를 만나보세요.
          </p>

          <div className="space-y-3">
            <Button asChild className="w-full bg-shop-rose hover:bg-shop-rose/90">
              <Link href="/">홈으로 가기</Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href="/products">상품 둘러보기</Link>
            </Button>
          </div>

          <div className="mt-8 p-4 bg-pink-50 rounded-lg">
            <p className="text-sm text-gray-700">
              💝 <strong>회원가입 축하 이벤트</strong>
              <br />
              지금 가입하신 모든 회원님께
              <br />
              <strong className="text-shop-rose">3,000원 할인 쿠폰</strong>을
              드립니다!
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

