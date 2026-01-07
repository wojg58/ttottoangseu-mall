/**
 * @file app/admin/products/page.tsx
 * @description 관리자 상품 관리 페이지
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { isAdmin, getAdminProducts } from "@/actions/admin";
import BulkDeleteProductsButton from "@/components/bulk-delete-products-button";
import BulkRestoreProductsButton from "@/components/bulk-restore-products-button";
import ProductSearch from "@/components/admin/product-search";
import ProductListWithSelection from "@/components/admin/product-list-with-selection";

interface AdminProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const searchQuery = params.search || undefined;

  const { products, total, totalPages } = await getAdminProducts(
    page,
    20,
    searchQuery,
  );

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-[#4a3f48]">상품 관리</h1>
            <span className="text-sm text-[#8b7d84]">총 {total}개</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/products/batch-upload">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#8b7d84] text-white rounded-lg hover:bg-[#7a6d74] transition-colors">
                <ImageIcon className="w-4 h-4" />
                이미지 일괄 업로드
              </button>
            </Link>
            <Link href="/admin/products/import">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#4a3f48] text-white rounded-lg hover:bg-[#3a3338] transition-colors">
                <FileText className="w-4 h-4" />
                상품 이관
              </button>
            </Link>
            <Link href="/admin/products/new">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#ff6b9d] text-white rounded-lg hover:bg-[#ff5088] transition-colors">
                <Plus className="w-4 h-4" />
                상품 등록
              </button>
            </Link>
            <BulkRestoreProductsButton />
            {total > 0 && <BulkDeleteProductsButton />}
          </div>
        </div>

        {/* 검색창 */}
        <ProductSearch />

        {/* 상품 목록 */}
        {products.length > 0 ? (
          <ProductListWithSelection 
            products={products}
            currentPage={page.toString()}
            currentSearch={searchQuery}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <p className="text-[#8b7d84] mb-4">등록된 상품이 없습니다.</p>
            <Link href="/admin/products/new">
              <button className="px-4 py-2 bg-[#ff6b9d] text-white rounded-lg hover:bg-[#ff5088] transition-colors">
                첫 상품 등록하기
              </button>
            </Link>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => {
                const params = new URLSearchParams();
                params.set("page", pageNum.toString());
                if (searchQuery) {
                  params.set("search", searchQuery);
                }
                return (
                  <Link
                    key={pageNum}
                    href={`/admin/products?${params.toString()}`}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                      pageNum === page
                        ? "bg-[#ff6b9d] text-white"
                        : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              },
            )}
          </div>
        )}
      </div>
    </main>
  );
}
