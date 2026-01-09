/**
 * @file app/mypage/orders/[id]/page.tsx
 * @description 주문 상세 페이지
 */

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Home, Package, MapPin, CreditCard } from "lucide-react";
import { getOrderById } from "@/actions/orders";
import DateDisplay from "@/components/date-display";
import NumberDisplay from "@/components/number-display";
import OrderCancelButton from "@/components/order-cancel-button";

interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/mypage/orders");
  }

  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

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
          <Link href="/mypage/orders" className="hover:text-[#ff6b9d]">
            주문 내역
          </Link>
          <span>/</span>
          <span className="text-[#4a3f48]">{order.order_number}</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[#4a3f48]">주문 상세</h1>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              order.status === "PAID"
                ? "bg-green-100 text-green-600"
                : order.status === "CANCELED"
                ? "bg-gray-100 text-gray-600"
                : order.status === "REFUNDED"
                ? "bg-orange-100 text-orange-600"
                : "bg-[#ffeef5] text-[#ff6b9d]"
            }`}
          >
            {order.status === "PENDING" && "결제 대기"}
            {order.status === "PAID" && "결제 완료"}
            {order.status === "CANCELED" && "주문 취소"}
            {order.status === "REFUNDED" && "환불 완료"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 주문 상품 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Package className="w-5 h-5 text-[#ff6b9d]" />
                <h2 className="font-bold text-[#4a3f48]">주문 상품</h2>
              </div>

              <div className="space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-4 bg-[#ffeef5] rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-[#4a3f48]">
                        {item.product_name}
                      </p>
                      {item.variant_info && (
                        <p className="text-sm text-[#8b7d84]">
                          옵션: {item.variant_info}
                        </p>
                      )}
                      <p className="text-sm text-[#8b7d84]">
                        <NumberDisplay value={item.price} suffix="원" /> × {item.quantity}개
                      </p>
                    </div>
                    <NumberDisplay
                      value={item.price * item.quantity}
                      suffix="원"
                      className="font-bold text-[#4a3f48]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 주문 정보 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 주문 정보 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-[#ff6b9d]" />
                <h2 className="font-bold text-[#4a3f48]">주문 정보</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8b7d84]">주문번호</span>
                  <span className="text-[#4a3f48]">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b7d84]">주문일시</span>
                  <DateDisplay
                    date={order.created_at}
                    format="date"
                    className="text-[#4a3f48]"
                  />
                </div>
                <hr className="border-[#f5d5e3]" />
                <div className="flex justify-between font-bold">
                  <span className="text-[#4a3f48]">결제금액</span>
                  <NumberDisplay
                    value={order.total_amount}
                    suffix="원"
                    className="text-[#ff6b9d]"
                  />
                </div>
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-[#ff6b9d]" />
                <h2 className="font-bold text-[#4a3f48]">배송 정보</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8b7d84]">수령인</span>
                  <span className="text-[#4a3f48]">{order.shipping_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b7d84]">연락처</span>
                  <span className="text-[#4a3f48]">{order.shipping_phone}</span>
                </div>
                <div>
                  <span className="text-[#8b7d84]">배송지</span>
                  <p className="text-[#4a3f48] mt-1">
                    [{order.shipping_zip_code}] {order.shipping_address}
                  </p>
                </div>
                {order.shipping_memo && (
                  <div>
                    <span className="text-[#8b7d84]">배송 메모</span>
                    <p className="text-[#4a3f48] mt-1">{order.shipping_memo}</p>
                  </div>
                )}
                {order.tracking_number && (
                  <div className="pt-3 border-t border-[#f5d5e3]">
                    <span className="text-[#8b7d84]">운송장 번호</span>
                    <p className="text-[#4a3f48] font-medium mt-1">
                      {order.tracking_number}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 주문 취소 버튼 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <OrderCancelButton orderId={order.id} orderStatus={order.status} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
