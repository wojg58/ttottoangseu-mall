/**
 * @file app/payments/quick/page.tsx
 * @description 간단한 결제 페이지 (12,200원 고정)
 *
 * 주요 기능:
 * 1. 12,200원 고정 금액으로 바로 결제
 * 2. 최소한의 정보 입력 (이름, 이메일, 전화번호)
 * 3. 토스페이먼츠 결제 위젯 연동
 *
 * @dependencies
 * - @tosspayments/payment-widget-sdk: 토스페이먼츠 결제 위젯
 * - components/payment-widget.tsx: 결제 위젯 컴포넌트
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Home } from "lucide-react";
import QuickPaymentForm from "@/components/quick-payment-form";

export const dynamic = "force-dynamic";

export default async function QuickPaymentPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect_url=/payments/quick");
  }

  console.log("[QuickPaymentPage] 렌더링");

  return (
    <main className="py-8">
      <div className="shop-container max-w-2xl mx-auto">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-sm text-[#8b7d84] mb-6">
          <Link
            href="/"
            className="hover:text-[#ff6b9d] flex items-center gap-1"
          >
            <Home className="w-4 h-4" />홈
          </Link>
          <span>/</span>
          <span className="text-[#4a3f48]">간편 결제</span>
        </nav>

        <h1 className="text-2xl font-bold text-[#4a3f48] mb-8">간편 결제</h1>

        <QuickPaymentForm />
      </div>
    </main>
  );
}

