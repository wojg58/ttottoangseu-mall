/**
 * @file app/admin/support/page.tsx
 * @description 관리자 리뷰/문의 관리 페이지
 *
 * 주요 기능:
 * 1. 리뷰 목록
 * 2. 문의 목록 (미답변 필터)
 * 3. 문의 답변 작성
 */

import { redirect } from "next/navigation";
import { isAdmin, getAdminReviews, getAdminInquiries } from "@/actions/admin";
import SupportTabs from "@/components/admin/support-tabs";

interface SupportPageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function SupportPage({
  searchParams,
}: SupportPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const tab = params.tab || "inquiries";
  const page = parseInt(params.page || "1", 10);
  const status = params.status;
  const searchQuery = params.search || undefined;

  const { inquiries, total: inquiriesTotal, totalPages: inquiriesTotalPages } =
    await getAdminInquiries(page, 20, status, searchQuery);

  const { reviews, total: reviewsTotal, totalPages: reviewsTotalPages } =
    await getAdminReviews(page, 20, searchQuery);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
          리뷰/문의 관리
        </h1>
        <p className="text-sm text-[#8b7d84]">
          상품 리뷰와 문의를 관리하고 답변할 수 있습니다.
        </p>
      </div>

      <SupportTabs
        activeTab={tab}
        inquiries={inquiries}
        inquiriesTotal={inquiriesTotal}
        inquiriesTotalPages={inquiriesTotalPages}
        reviews={reviews}
        reviewsTotal={reviewsTotal}
        reviewsTotalPages={reviewsTotalPages}
        currentPage={page}
        status={status}
        searchQuery={searchQuery}
      />
    </>
  );
}
