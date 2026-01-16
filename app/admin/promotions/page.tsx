/**
 * @file app/admin/promotions/page.tsx
 * @description 관리자 프로모션 관리 페이지
 *
 * 주요 기능:
 * 1. 쿠폰 목록
 * 2. 쿠폰 상태 필터
 * 3. 쿠폰 검색
 *
 * TODO: 쿠폰 생성 기능 (추후 구현)
 */

import { redirect } from "next/navigation";
import { isAdmin, getAdminCoupons } from "@/actions/admin";
import CouponList from "@/components/admin/coupon-list";

interface PromotionsPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function PromotionsPage({
  searchParams,
}: PromotionsPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status;
  const searchQuery = params.search || undefined;

  const { coupons, total, totalPages } = await getAdminCoupons(
    page,
    20,
    status,
    searchQuery,
  );

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
          프로모션 관리
        </h1>
        <p className="text-sm text-[#8b7d84]">
          쿠폰을 조회하고 관리할 수 있습니다.
        </p>
        <p className="text-sm text-[#8b7d84] mt-1">
          총 {total}개의 쿠폰이 있습니다.
        </p>
      </div>

      <CouponList
        coupons={coupons}
        total={total}
        totalPages={totalPages}
        currentPage={page}
        status={status}
        searchQuery={searchQuery}
      />
    </>
  );
}
