/**
 * @file app/admin/inventory/page.tsx
 * @description 관리자 재고 관리 페이지
 *
 * 주요 기능:
 * 1. 재고 목록 (SKU/옵션별)
 * 2. 재고 수정 (단건)
 * 3. 재고부족 상품 필터링
 */

import { redirect } from "next/navigation";
import { getInventoryList } from "@/actions/admin";
import InventoryList from "@/components/admin/inventory-list";

interface InventoryPageProps {
  searchParams: Promise<{
    page?: string;
    lowStock?: string;
    search?: string;
    status?: string;
  }>;
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  // 주의: 관리자 권한은 app/admin/layout.tsx에서 이미 확인됨
  // 여기서는 중복 체크하지 않음 (레이아웃에서 이미 리다이렉트 처리)

  // searchParams 파싱
  let params;
  try {
    params = await searchParams;
  } catch (error) {
    console.error("[InventoryPage] searchParams 파싱 실패:", error);
    redirect("/admin");
  }

  const page = parseInt(params.page || "1", 10);
  const lowStockOnly = params.lowStock === "true";
  const searchQuery = params.search || undefined;
  const status = params.status as "active" | "hidden" | "sold_out" | undefined;

  // 재고 목록 조회 (에러 처리 추가)
  let items: any[] = [];
  let total = 0;
  let totalPages = 0;

  try {
    const result = await getInventoryList(
      page,
      20,
      lowStockOnly,
      searchQuery,
      status,
    );
    items = result.items;
    total = result.total;
    totalPages = result.totalPages;
  } catch (error) {
    console.error("[InventoryPage] 재고 목록 조회 실패:", error);
    // 에러 발생 시 빈 목록으로 표시 (페이지는 계속 렌더링)
    items = [];
    total = 0;
    totalPages = 0;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
          재고 관리
        </h1>
        <p className="text-sm text-[#8b7d84]">
          상품 및 옵션별 재고를 조회하고 수정할 수 있습니다.
        </p>
        <p className="text-sm text-[#8b7d84] mt-1">
          총 {total}개의 재고 항목이 있습니다.
        </p>
      </div>

      <InventoryList
        items={items}
        total={total}
        totalPages={totalPages}
        currentPage={page}
        lowStockOnly={lowStockOnly}
        searchQuery={searchQuery}
        status={status}
      />
    </>
  );
}
