/**
 * @file app/admin/orders/page.tsx
 * @description 관리자 주문 관리 페이지
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isAdmin, getAllOrders } from "@/actions/admin";
import AdminOrderRow from "@/components/admin-order-row";

interface AdminOrdersPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const status = params.status;
  const page = parseInt(params.page || "1", 10);

  const { orders, total, totalPages } = await getAllOrders(status, page);

  const statusFilters = [
    { value: "", label: "전체" },
    { value: "pending", label: "결제 대기" },
    { value: "confirmed", label: "결제 완료" },
    { value: "preparing", label: "상품 준비중" },
    { value: "shipped", label: "배송중" },
    { value: "delivered", label: "배송 완료" },
    { value: "cancelled", label: "주문 취소" },
  ];

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[#4a3f48]">주문 관리</h1>
          <span className="text-sm text-[#8b7d84]">총 {total}건</span>
        </div>

        {/* 상태 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {statusFilters.map((filter) => (
            <Link
              key={filter.value}
              href={`/admin/orders${
                filter.value ? `?status=${filter.value}` : ""
              }`}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                (status || "") === filter.value
                  ? "bg-[#ff6b9d] text-white"
                  : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {/* 주문 목록 */}
        {orders.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      주문번호
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      주문자
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      연락처
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      금액
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      상태
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      주문일시
                    </th>
                    <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <AdminOrderRow key={order.id} order={order} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <p className="text-[#8b7d84]">주문이 없습니다.</p>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <Link
                  key={pageNum}
                  href={`/admin/orders?${new URLSearchParams({
                    ...(status ? { status } : {}),
                    page: pageNum.toString(),
                  }).toString()}`}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                    pageNum === page
                      ? "bg-[#ff6b9d] text-white"
                      : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
                  }`}
                >
                  {pageNum}
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
