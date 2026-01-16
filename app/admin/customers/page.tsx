/**
 * @file app/admin/customers/page.tsx
 * @description 관리자 고객/회원 관리 페이지
 *
 * 주요 기능:
 * 1. 회원 리스트
 * 2. 검색 (이름, 이메일, 전화번호)
 * 3. 정렬 (가입일, 최근주문일, 주문횟수, 총구매액)
 */

import { redirect } from "next/navigation";
import { isAdmin, getCustomers } from "@/actions/admin";
import CustomerList from "@/components/admin/customer-list";

interface CustomersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort?: string;
  }>;
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const searchQuery = params.search || undefined;
  const sortBy = params.sort || "created_at";

  const { customers, total, totalPages } = await getCustomers(
    page,
    20,
    searchQuery,
    sortBy,
  );

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
          고객/회원 관리
        </h1>
        <p className="text-sm text-[#8b7d84]">
          회원 정보를 조회하고 주문 이력을 확인할 수 있습니다.
        </p>
        <p className="text-sm text-[#8b7d84] mt-1">
          총 {total}명의 회원이 있습니다.
        </p>
      </div>

      <CustomerList
        customers={customers}
        total={total}
        totalPages={totalPages}
        currentPage={page}
        searchQuery={searchQuery}
        sortBy={sortBy}
      />
    </>
  );
}
