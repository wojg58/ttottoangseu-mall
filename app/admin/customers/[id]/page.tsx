/**
 * @file app/admin/customers/[id]/page.tsx
 * @description 관리자 회원 상세 페이지
 *
 * 주요 기능:
 * 1. 회원 기본 정보
 * 2. 주문 이력
 * 3. 주문 통계
 */

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft, User, Mail, Phone, ShoppingBag, DollarSign, Calendar } from "lucide-react";
import { isAdmin, getCustomerById } from "@/actions/admin";
import NumberDisplay from "@/components/number-display";
import DateDisplay from "@/components/date-display";

interface CustomerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  // 상태 한글 변환
  const formatPaymentStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      PENDING: "결제 대기",
      PAID: "결제 완료",
      CANCELED: "주문 취소",
      REFUNDED: "환불 완료",
    };
    return statusMap[status] || status;
  };

  const formatFulfillmentStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      UNFULFILLED: "미처리",
      PREPARING: "상품 준비중",
      SHIPPED: "배송중",
      DELIVERED: "배송 완료",
      CANCELED: "주문 취소",
    };
    return statusMap[status] || status;
  };

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/customers"
          className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-[#4a3f48]">회원 상세</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 회원 정보 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-bold text-[#4a3f48] mb-4">회원 정보</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-[#8b7d84] mb-1">
                  <User className="w-4 h-4" />
                  이름
                </div>
                <p className="text-[#4a3f48] font-medium">
                  {customer.name || "이름 없음"}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-[#8b7d84] mb-1">
                  <Mail className="w-4 h-4" />
                  이메일
                </div>
                <p className="text-[#4a3f48]">{customer.email}</p>
              </div>
              {customer.phone && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-[#8b7d84] mb-1">
                    <Phone className="w-4 h-4" />
                    전화번호
                  </div>
                  <p className="text-[#4a3f48]">{customer.phone}</p>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 text-sm text-[#8b7d84] mb-1">
                  <Calendar className="w-4 h-4" />
                  가입일
                </div>
                <p className="text-[#4a3f48]">
                  <DateDisplay date={customer.created_at} format="datetime" />
                </p>
              </div>
            </div>
          </div>

          {/* 주문 통계 */}
          <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
            <h2 className="font-bold text-[#4a3f48] mb-4">주문 통계</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-[#8b7d84] mb-1">
                  <ShoppingBag className="w-4 h-4" />
                  주문 횟수
                </div>
                <p className="text-2xl font-bold text-[#4a3f48]">
                  {customer.order_count}건
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-[#8b7d84] mb-1">
                  <DollarSign className="w-4 h-4" />
                  총 구매액
                </div>
                <p className="text-2xl font-bold text-[#4a3f48]">
                  <NumberDisplay value={customer.total_spent} suffix="원" />
                </p>
              </div>
              {customer.last_order_at && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-[#8b7d84] mb-1">
                    <Calendar className="w-4 h-4" />
                    최근 주문일
                  </div>
                  <p className="text-[#4a3f48]">
                    <DateDisplay date={customer.last_order_at} format="datetime" />
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 주문 이력 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-bold text-[#4a3f48] mb-4">주문 이력</h2>
            {customer.orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                        주문번호
                      </th>
                      <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                        금액
                      </th>
                      <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                        결제상태
                      </th>
                      <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                        배송상태
                      </th>
                      <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                        주문일시
                      </th>
                      <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-3 px-2">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-[#ff6b9d] hover:underline font-medium"
                          >
                            {order.order_number}
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-[#4a3f48] font-medium">
                          <NumberDisplay value={order.total_amount} suffix="원" />
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              order.payment_status === "PAID"
                                ? "bg-green-100 text-green-600"
                                : order.payment_status === "CANCELED"
                                ? "bg-gray-100 text-gray-600"
                                : order.payment_status === "REFUNDED"
                                ? "bg-orange-100 text-orange-600"
                                : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {formatPaymentStatus(order.payment_status)}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              order.fulfillment_status === "DELIVERED"
                                ? "bg-green-100 text-green-600"
                                : order.fulfillment_status === "SHIPPED"
                                ? "bg-blue-100 text-blue-600"
                                : order.fulfillment_status === "PREPARING"
                                ? "bg-yellow-100 text-yellow-600"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {formatFulfillmentStatus(order.fulfillment_status)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-[#8b7d84]">
                          <DateDisplay
                            date={order.paid_at || order.created_at}
                            format="date"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-sm text-[#ff6b9d] hover:underline"
                          >
                            보기
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-[#8b7d84]">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>주문 이력이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
