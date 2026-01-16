/**
 * @file app/admin/analytics/page.tsx
 * @description 관리자 통계 페이지
 *
 * 주요 기능:
 * 1. 기간별 매출 통계
 * 2. 베스트 상품 (판매량/매출 기준)
 * 3. 취소율
 * 4. 주문 통계
 */

import { redirect } from "next/navigation";
import { isAdmin, getAnalyticsData } from "@/actions/admin";
import AnalyticsDashboard from "@/components/admin/analytics-dashboard";

export default async function AnalyticsPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const analytics = await getAnalyticsData();

  if (!analytics) {
    redirect("/");
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">통계</h1>
        <p className="text-sm text-[#8b7d84]">
          매출, 주문, 상품 통계를 확인할 수 있습니다.
        </p>
      </div>

      <AnalyticsDashboard data={analytics} />
    </>
  );
}
