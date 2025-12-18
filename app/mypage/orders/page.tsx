/**
 * @file app/mypage/orders/page.tsx
 * @description 주문 내역 페이지
 */

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Home, Package, ChevronRight } from "lucide-react";
import { getOrders } from "@/actions/orders";
import DateDisplay from "@/components/date-display";
import NumberDisplay from "@/components/number-display";

export default async function OrdersPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/mypage/orders");
  }

  const orders = await getOrders();

  return (
    <main className="py-8">
      <div className="shop-container">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-sm text-[#8b7d84] mb-6">
          <Link
            href="/"
            className="hover:text-[#ff6b9d] flex items-center gap-1"
          >
            <Home className="w-4 h-4" />홈
          </Link>
          <span>/</span>
          <Link href="/mypage" className="hover:text-[#ff6b9d]">
            마이페이지
          </Link>
          <span>/</span>
          <span className="text-[#4a3f48]">주문 내역</span>
        </nav>

        <h1 className="text-2xl font-bold text-[#4a3f48] mb-8">주문 내역</h1>

        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/mypage/orders/${order.id}`}
                className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-lg font-bold text-[#4a3f48]">
                      {order.order_number}
                    </span>
                    <DateDisplay
                      date={order.created_at}
                      format="datetime"
                      className="text-sm text-[#8b7d84]"
                    />
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === "delivered"
                        ? "bg-green-100 text-green-600"
                        : order.status === "shipped"
                        ? "bg-blue-100 text-blue-600"
                        : order.status === "cancelled"
                        ? "bg-gray-100 text-gray-600"
                        : "bg-[#ffeef5] text-[#ff6b9d]"
                    }`}
                  >
                    {order.status === "pending" && "결제 대기"}
                    {order.status === "confirmed" && "결제 완료"}
                    {order.status === "preparing" && "상품 준비중"}
                    {order.status === "shipped" && "배송중"}
                    {order.status === "delivered" && "배송 완료"}
                    {order.status === "cancelled" && "주문 취소"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#f5d5e3]">
                  <div>
                    <p className="text-sm text-[#8b7d84]">배송지</p>
                    <p className="text-[#4a3f48]">
                      {order.shipping_name} · {order.shipping_address}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-[#8b7d84]">결제금액</p>
                      <NumberDisplay
                        value={order.total_amount}
                        suffix="원"
                        className="text-lg font-bold text-[#ff6b9d]"
                      />
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#8b7d84]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <Package className="w-16 h-16 mx-auto text-[#fad2e6] mb-4" />
            <h2 className="text-lg font-bold text-[#4a3f48] mb-2">
              주문 내역이 없습니다
            </h2>
            <p className="text-[#8b7d84] mb-6">
              첫 주문의 설렘을 경험해보세요!
            </p>
            <Link href="/products" className="shop-btn-accent inline-block">
              쇼핑하러 가기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
