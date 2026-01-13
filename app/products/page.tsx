/**
 * @file app/products/page.tsx
 * @description 상품 리스트 페이지
 *
 * 주요 기능:
 * 1. 전체 상품 목록 표시
 * 2. 필터링 (베스트, 신상품, 할인)
 * 3. 정렬 기능
 * 4. 페이지네이션
 */

import Link from "next/link";
import { Home } from "lucide-react";
import { getProducts } from "@/actions/products";
import ProductCard from "@/components/product-card";
import ProductSortSelect from "@/components/product-sort-select";

interface ProductsPageProps {
  searchParams: Promise<{
    featured?: string;
    new?: string;
    sale?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  // 필터 파싱
  const filters = {
    featured: params.featured === "true",
    isNew: params.new === "true",
    onSale: params.sale === "true",
    search: params.search,
    sortBy:
      (params.sort as "newest" | "price_asc" | "price_desc" | "name") ||
      "newest",
  };

  const page = parseInt(params.page || "1", 10);

  // 데이터 로드 (한 줄에 4개씩 6줄 = 24개)
  const productsResult = await getProducts(filters, page, 24);

  // 페이지 타이틀 결정
  let pageTitle = "전체 상품";
  if (filters.featured) pageTitle = "베스트 상품";
  if (filters.isNew) pageTitle = "신상품";
  if (filters.onSale) pageTitle = "할인 상품";
  if (filters.search) pageTitle = `"${filters.search}" 검색 결과`;

  return (
    <main className="py-8 bg-white min-h-screen">
      <div className="shop-container">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-sm text-[#8b7d84] mb-6">
          <Link
            href="/"
            className="hover:text-[#ff6b9d] flex items-center gap-1"
          >
            <Home className="w-4 h-4" />홈
          </Link>
          <span>/</span>
          <span className="text-[#4a3f48]">{pageTitle}</span>
          <span className="ml-auto text-xs">총 {productsResult.total}개</span>
        </nav>

        {/* 메인 컨텐츠 */}
        <div>
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[#4a3f48]">{pageTitle}</h1>

              {/* 정렬 */}
              <ProductSortSelect defaultValue={filters.sortBy} />
            </div>

            {/* 상품 그리드 (한 줄에 4개씩, 6줄 = 24개) */}
            {productsResult.data.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-4">
                  {productsResult.data.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* 페이지네이션 (24개씩) */}
                {productsResult.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    {/* 이전 페이지 */}
                    {page > 1 && (
                      <Link
                        href={`/products?${new URLSearchParams({
                          ...params,
                          page: (page - 1).toString(),
                        }).toString()}`}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] transition-colors"
                      >
                        ‹
                      </Link>
                    )}

                    {/* 페이지 번호 (모든 페이지 표시) */}
                    {Array.from(
                      { length: productsResult.totalPages },
                      (_, i) => i + 1,
                    ).map((pageNum) => (
                      <Link
                        key={pageNum}
                        href={`/products?${new URLSearchParams({
                          ...params,
                          page: pageNum.toString(),
                        }).toString()}`}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                          pageNum === page
                            ? "bg-[#ff6b9d] text-white"
                            : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
                        }`}
                      >
                        {pageNum}
                      </Link>
                    ))}

                    {/* 다음 페이지 */}
                    {page < productsResult.totalPages && (
                      <Link
                        href={`/products?${new URLSearchParams({
                          ...params,
                          page: (page + 1).toString(),
                        }).toString()}`}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm bg-white text-[#4a3f48] hover:bg-[#ffeef5] transition-colors"
                      >
                        ›
                      </Link>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <span className="text-6xl mb-4 block">🎀</span>
                <h3 className="text-lg font-bold text-[#4a3f48] mb-2">
                  상품이 없습니다
                </h3>
                <p className="text-[#8b7d84] mb-4">
                  {filters.search
                    ? "다른 검색어로 다시 시도해보세요."
                    : "곧 새로운 상품이 등록될 예정이에요!"}
                </p>
                <Link
                  href="/products"
                  className="shop-btn-primary inline-block"
                >
                  전체 상품 보기
                </Link>
              </div>
            )}
        </div>
      </div>
    </main>
  );
}
