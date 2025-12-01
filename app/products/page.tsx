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

import { Suspense } from "react";
import Link from "next/link";
import { Filter, Home } from "lucide-react";
import { getProducts, getCategories } from "@/actions/products";
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

  console.log("[ProductsPage] 렌더링, params:", params);

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

  // 데이터 로드
  const [productsResult, categories] = await Promise.all([
    getProducts(filters, page, 12),
    getCategories(),
  ]);

  // 페이지 타이틀 결정
  let pageTitle = "전체 상품";
  if (filters.featured) pageTitle = "베스트 상품";
  if (filters.isNew) pageTitle = "신상품";
  if (filters.onSale) pageTitle = "할인 상품";
  if (filters.search) pageTitle = `"${filters.search}" 검색 결과`;

  return (
    <main className="py-8">
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

        <div className="flex flex-col lg:flex-row gap-8">
          {/* 사이드바 - 카테고리 */}
          <aside className="lg:w-64 shrink-0">
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
              <h2 className="font-bold text-[#4a3f48] mb-4 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                카테고리
              </h2>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/products"
                    className={`block py-2 px-3 rounded-lg transition-colors ${
                      !params.featured && !params.new && !params.sale
                        ? "bg-[#ffeef5] text-[#ff6b9d] font-medium"
                        : "hover:bg-[#ffeef5] text-[#4a3f48]"
                    }`}
                  >
                    전체 상품
                  </Link>
                </li>
                <li>
                  <Link
                    href="/products?featured=true"
                    className={`block py-2 px-3 rounded-lg transition-colors ${
                      params.featured === "true"
                        ? "bg-[#ffeef5] text-[#ff6b9d] font-medium"
                        : "hover:bg-[#ffeef5] text-[#4a3f48]"
                    }`}
                  >
                    🏆 베스트
                  </Link>
                </li>
                <li>
                  <Link
                    href="/products?new=true"
                    className={`block py-2 px-3 rounded-lg transition-colors ${
                      params.new === "true"
                        ? "bg-[#ffeef5] text-[#ff6b9d] font-medium"
                        : "hover:bg-[#ffeef5] text-[#4a3f48]"
                    }`}
                  >
                    ✨ 신상품
                  </Link>
                </li>
                <li>
                  <Link
                    href="/products?sale=true"
                    className={`block py-2 px-3 rounded-lg transition-colors ${
                      params.sale === "true"
                        ? "bg-[#ffeef5] text-[#ff6b9d] font-medium"
                        : "hover:bg-[#ffeef5] text-[#4a3f48]"
                    }`}
                  >
                    🏷️ 할인
                  </Link>
                </li>
              </ul>

              {/* 카테고리 목록 */}
              {categories.length > 0 && (
                <>
                  <hr className="my-4 border-[#f5d5e3]" />
                  <ul className="space-y-2">
                    {categories.map((category) => (
                      <li key={category.id}>
                        <Link
                          href={`/products/category/${category.slug}`}
                          className="block py-2 px-3 rounded-lg hover:bg-[#ffeef5] text-[#4a3f48] transition-colors"
                        >
                          {category.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </aside>

          {/* 메인 컨텐츠 */}
          <div className="flex-1">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[#4a3f48]">{pageTitle}</h1>

              {/* 정렬 */}
              <ProductSortSelect defaultValue={filters.sortBy} />
            </div>

            {/* 상품 그리드 */}
            {productsResult.data.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {productsResult.data.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* 페이지네이션 */}
                {productsResult.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
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
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 bg-[#ffeef5] rounded-xl">
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
      </div>
    </main>
  );
}
