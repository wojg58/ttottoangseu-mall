/**
 * @file app/admin/page.tsx
 * @description 관리자 대시보드
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { isAdmin, getDashboardStats } from "@/actions/admin";
import DateDisplay from "@/components/date-display";
import NumberDisplay from "@/components/number-display";

export default async function AdminDashboardPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const stats = await getDashboardStats();

  if (!stats) {
    redirect("/");
  }

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-8">
          관리자 대시보드
        </h1>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#ffeef5] rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-[#ff6b9d]" />
              </div>
              <span className="text-xs text-[#8b7d84]">전체</span>
            </div>
            <NumberDisplay
              value={stats.totalOrders}
              className="text-2xl font-bold text-[#4a3f48]"
            />
            <p className="text-sm text-[#8b7d84]">총 주문</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-500" />
              </div>
              <span className="text-xs text-orange-500">처리 필요</span>
            </div>
            <NumberDisplay
              value={stats.pendingOrders}
              className="text-2xl font-bold text-[#4a3f48]"
            />
            <p className="text-sm text-[#8b7d84]">대기 중인 주문</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <span className="text-xs text-green-500">수익</span>
            </div>
            <NumberDisplay
              value={stats.totalRevenue}
              suffix="원"
              className="text-2xl font-bold text-[#4a3f48]"
            />
            <p className="text-sm text-[#8b7d84]">총 매출</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-xs text-blue-500">활성</span>
            </div>
            <NumberDisplay
              value={stats.totalProducts}
              className="text-2xl font-bold text-[#4a3f48]"
            />
            <p className="text-sm text-[#8b7d84]">등록 상품</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 빠른 메뉴 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-[#4a3f48] mb-4">빠른 메뉴</h2>
              <nav className="space-y-2">
                <Link
                  href="/admin/orders"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[#ffeef5] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-[#ff6b9d]" />
                    <span className="text-[#4a3f48]">주문 관리</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8b7d84]" />
                </Link>
                <Link
                  href="/admin/products"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[#ffeef5] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-[#ff6b9d]" />
                    <span className="text-[#4a3f48]">상품 관리</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8b7d84]" />
                </Link>
              </nav>
            </div>
          </div>

          {/* 최근 주문 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[#4a3f48]">최근 주문</h2>
                <Link
                  href="/admin/orders"
                  className="text-sm text-[#ff6b9d] hover:underline"
                >
                  전체 보기
                </Link>
              </div>

              {stats.recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                          주문번호
                        </th>
                        <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                          주문자
                        </th>
                        <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                          금액
                        </th>
                        <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                          상태
                        </th>
                        <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                          일시
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-gray-50 hover:bg-gray-50"
                        >
                          <td className="py-3 px-2">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="text-[#ff6b9d] hover:underline"
                            >
                              {order.order_number}
                            </Link>
                          </td>
                          <td className="py-3 px-2 text-[#4a3f48]">
                            {order.shipping_name}
                          </td>
                          <td className="py-3 px-2 text-[#4a3f48] font-medium">
                            <NumberDisplay value={order.total_amount} suffix="원" />
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
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
                              {order.status === "preparing" && "준비중"}
                              {order.status === "shipped" && "배송중"}
                              {order.status === "delivered" && "배송 완료"}
                              {order.status === "cancelled" && "취소"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-[#8b7d84]">
                            <DateDisplay date={order.created_at} format="date" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-[#8b7d84]">
                  주문이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
