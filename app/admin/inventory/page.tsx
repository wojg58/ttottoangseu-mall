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
import { isAdmin, getInventoryList } from "@/actions/admin";
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
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const lowStockOnly = params.lowStock === "true";
  const searchQuery = params.search || undefined;
  const status = params.status as "active" | "hidden" | "sold_out" | undefined;

  const { items, total, totalPages } = await getInventoryList(
    page,
    20,
    lowStockOnly,
    searchQuery,
    status,
  );

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
