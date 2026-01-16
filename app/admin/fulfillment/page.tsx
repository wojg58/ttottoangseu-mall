/**
 * @file app/admin/fulfillment/page.tsx
 * @description 관리자 배송/출고 페이지
 *
 * 주요 기능:
 * 1. 배송 대기 주문 목록 (결제완료 + 배송대기)
 * 2. 송장번호 등록 (단건/일괄)
 * 3. 배송 상태 업데이트
 */

import { redirect } from "next/navigation";
import { isAdmin, getPendingFulfillmentOrders } from "@/actions/admin";
import FulfillmentOrderList from "@/components/admin/fulfillment-order-list";

interface FulfillmentPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function FulfillmentPage({
  searchParams,
}: FulfillmentPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const { orders, total, totalPages } = await getPendingFulfillmentOrders(
    page,
    20,
  );

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
          배송/출고 관리
        </h1>
        <p className="text-sm text-[#8b7d84]">
          결제 완료된 주문의 송장번호를 등록하고 배송 상태를 관리합니다.
        </p>
        <p className="text-sm text-[#8b7d84] mt-1">
          총 {total}건의 배송 대기 주문이 있습니다.
        </p>
      </div>

      <FulfillmentOrderList
        orders={orders}
        total={total}
        totalPages={totalPages}
        currentPage={page}
      />
    </>
  );
}
