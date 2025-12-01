/**
 * @file app/checkout/complete/page.tsx
 * @description 주문 완료 페이지
 */

import Link from "next/link";
import { CheckCircle2, Package, Home } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrderById } from "@/actions/orders";
import { Button } from "@/components/ui/button";

interface CompletePageProps {
  searchParams: Promise<{
    orderId?: string;
  }>;
}

export default async function CompletePage({
  searchParams,
}: CompletePageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const orderId = params.orderId;

  if (!orderId) {
    redirect("/");
  }

  const order = await getOrderById(orderId);

  if (!order) {
    redirect("/");
  }

  return (
    <main className="py-16">
      <div className="shop-container max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          {/* 성공 아이콘 */}
          <div className="w-20 h-20 bg-[#ffeef5] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#ff6b9d]" />
          </div>

          <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
            주문이 완료되었습니다!
          </h1>
          <p className="text-[#8b7d84] mb-8">
            감사합니다. 주문 내역은 마이페이지에서 확인하실 수 있습니다.
          </p>

          {/* 주문 정보 */}
          <div className="bg-[#ffeef5] rounded-xl p-6 text-left mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-[#ff6b9d]" />
              <span className="font-bold text-[#4a3f48]">주문 정보</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8b7d84]">주문번호</span>
                <span className="text-[#4a3f48] font-medium">
                  {order.order_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b7d84]">결제금액</span>
                <span className="text-[#ff6b9d] font-bold">
                  {order.total_amount.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b7d84]">수령인</span>
                <span className="text-[#4a3f48]">{order.shipping_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b7d84]">배송지</span>
                <span className="text-[#4a3f48] text-right max-w-[200px] truncate">
                  {order.shipping_address}
                </span>
              </div>
            </div>
          </div>

          {/* 버튼들 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/mypage/orders" className="flex-1">
              <Button
                variant="outline"
                className="w-full h-12 border-[#fad2e6] text-[#4a3f48] hover:bg-[#ffeef5]"
              >
                주문 내역 확인
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button className="w-full h-12 bg-[#ff6b9d] hover:bg-[#ff5088] text-white">
                <Home className="w-4 h-4 mr-2" />
                홈으로 돌아가기
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
