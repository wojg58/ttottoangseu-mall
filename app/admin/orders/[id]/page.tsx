/**
 * @file app/admin/orders/[id]/page.tsx
 * @description 관리자 주문 상세 페이지
 */

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft, Package, MapPin, CreditCard, User, Truck } from "lucide-react";
import { isAdmin, getAdminOrderById } from "@/actions/admin";
import DateDisplay from "@/components/date-display";
import NumberDisplay from "@/components/number-display";
import AdminOrderStatusForm from "@/components/admin-order-status-form";

interface AdminOrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminOrderDetailPage({
  params,
}: AdminOrderDetailPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const { id } = await params;
  const order = await getAdminOrderById(id);

  if (!order) {
    notFound();
  }

  // 결제 수단 한글 변환
  const formatPaymentMethod = (method: string | undefined): string => {
    const methodMap: Record<string, string> = {
      card: "카드",
      virtual_account: "가상계좌",
      transfer: "계좌이체",
      mobile: "휴대폰",
    };
    return methodMap[method || ""] || method || "";
  };

  // 상태 한글 변환
  const formatPaymentStatus = (status: string | undefined): string => {
    const statusMap: Record<string, string> = {
      PENDING: "결제 대기",
      PAID: "결제 완료",
      CANCELED: "주문 취소",
      REFUNDED: "환불 완료",
    };
    return statusMap[status || ""] || status || "";
  };

  const formatFulfillmentStatus = (status: string | undefined): string => {
    const statusMap: Record<string, string> = {
      UNFULFILLED: "미처리",
      PREPARING: "상품 준비중",
      SHIPPED: "배송중",
      DELIVERED: "배송 완료",
      CANCELED: "주문 취소",
    };
    return statusMap[status || ""] || status || "";
  };

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/orders"
            className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[#4a3f48]">주문 상세</h1>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              order.fulfillment_status === "DELIVERED"
                ? "bg-green-100 text-green-600"
                : order.fulfillment_status === "SHIPPED"
                ? "bg-blue-100 text-blue-600"
                : order.fulfillment_status === "PREPARING"
                ? "bg-yellow-100 text-yellow-600"
                : order.payment_status === "CANCELED"
                ? "bg-gray-100 text-gray-600"
                : order.payment_status === "REFUNDED"
                ? "bg-orange-100 text-orange-600"
                : order.payment_status === "PAID"
                ? "bg-[#ffeef5] text-[#ff6b9d]"
                : "bg-[#ffeef5] text-[#ff6b9d]"
            }`}
          >
            {order.fulfillment_status === "DELIVERED" && "배송 완료"}
            {order.fulfillment_status === "SHIPPED" && "배송중"}
            {order.fulfillment_status === "PREPARING" && "상품 준비중"}
            {order.payment_status === "PENDING" && "결제 대기"}
            {order.payment_status === "PAID" &&
              order.fulfillment_status === "UNFULFILLED" &&
              "결제 완료"}
            {order.payment_status === "CANCELED" && "주문 취소"}
            {order.payment_status === "REFUNDED" && "환불 완료"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 주문 상품 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 주문 상품 목록 */}
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

              <div className="mt-6 pt-6 border-t border-[#f5d5e3]">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-[#4a3f48]">총 주문금액</span>
                  <NumberDisplay
                    value={order.total_amount}
                    suffix="원"
                    className="text-2xl font-bold text-[#ff6b9d]"
                  />
                </div>
              </div>
            </div>

            {/* 주문 상태 관리 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Truck className="w-5 h-5 text-[#ff6b9d]" />
                <h2 className="font-bold text-[#4a3f48]">주문 상태 관리</h2>
              </div>
              <AdminOrderStatusForm order={order} />
            </div>
          </div>

          {/* 사이드바 정보 */}
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
                  <span className="text-[#4a3f48] font-medium">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b7d84]">주문일시</span>
                  <DateDisplay
                    date={order.created_at}
                    format="datetime"
                    className="text-[#4a3f48]"
                  />
                </div>
                {order.paid_at && (
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">결제완료일시</span>
                    <DateDisplay
                      date={order.paid_at}
                      format="datetime"
                      className="text-[#4a3f48]"
                    />
                  </div>
                )}
                <hr className="border-[#f5d5e3]" />
                <div className="flex justify-between">
                  <span className="text-[#8b7d84]">결제상태</span>
                  <span className="text-[#4a3f48] font-medium">
                    {formatPaymentStatus(order.payment_status)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b7d84]">배송상태</span>
                  <span className="text-[#4a3f48] font-medium">
                    {formatFulfillmentStatus(order.fulfillment_status)}
                  </span>
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

            {/* 결제 정보 */}
            {order.payment && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-[#ff6b9d]" />
                  <h2 className="font-bold text-[#4a3f48]">결제 정보</h2>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">결제수단</span>
                    <span className="text-[#4a3f48] font-medium">
                      {formatPaymentMethod(order.payment.method)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">결제금액</span>
                    <NumberDisplay
                      value={order.payment.amount}
                      suffix="원"
                      className="text-[#4a3f48] font-medium"
                    />
                  </div>
                  {order.payment.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-[#8b7d84]">결제승인일시</span>
                      <DateDisplay
                        date={order.payment.approved_at}
                        format="datetime"
                        className="text-[#4a3f48]"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 주문자 정보 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-[#ff6b9d]" />
                <h2 className="font-bold text-[#4a3f48]">주문자 정보</h2>
              </div>
              <div className="space-y-3 text-sm">
                {(order as any).orderer_name && (
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">주문자명</span>
                    <span className="text-[#4a3f48]">{(order as any).orderer_name}</span>
                  </div>
                )}
                {(order as any).orderer_phone && (
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">주문자연락처</span>
                    <span className="text-[#4a3f48]">{(order as any).orderer_phone}</span>
                  </div>
                )}
                {(order as any).orderer_email && (
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">주문자이메일</span>
                    <span className="text-[#4a3f48]">{(order as any).orderer_email}</span>
                  </div>
                )}
                {order.user_email && (
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">회원이메일</span>
                    <span className="text-[#4a3f48]">{order.user_email}</span>
                  </div>
                )}
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
                    {order.shipping_zip_code && `[${order.shipping_zip_code}] `}
                    {order.shipping_address}
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
                {order.shipped_at && (
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">배송시작일시</span>
                    <DateDisplay
                      date={order.shipped_at}
                      format="datetime"
                      className="text-[#4a3f48]"
                    />
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex justify-between">
                    <span className="text-[#8b7d84]">배송완료일시</span>
                    <DateDisplay
                      date={order.delivered_at}
                      format="datetime"
                      className="text-[#4a3f48]"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}




