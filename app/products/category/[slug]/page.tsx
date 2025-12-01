/**
 * @file app/products/category/[slug]/page.tsx
 * @description 카테고리별 상품 리스트 페이지
 */

import Link from "next/link";
import { Home } from "lucide-react";
import { notFound } from "next/navigation";
import {
  getProducts,
  getCategories,
  getCategoryBySlug,
} from "@/actions/products";
import ProductCard from "@/components/product-card";
import ProductSortSelect from "@/components/product-sort-select";

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    sort?: string;
    page?: string;
  }>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  console.log("[CategoryPage] 렌더링, slug:", slug);

  // 카테고리 정보 조회
  const category = await getCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  // 필터 설정
  const filters = {
    categorySlug: slug,
    sortBy:
      (search.sort as "newest" | "price_asc" | "price_desc" | "name") ||
      "newest",
  };

  const page = parseInt(search.page || "1", 10);

  // 데이터 로드
  const [productsResult, categories] = await Promise.all([
    getProducts(filters, page, 12),
    getCategories(),
  ]);

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
          <Link href="/products" className="hover:text-[#ff6b9d]">
            상품
          </Link>
          <span>/</span>
          <span className="text-[#4a3f48]">{category.name}</span>
          <span className="ml-auto text-xs">총 {productsResult.total}개</span>
        </nav>

        {/* 카테고리 헤더 */}
        <div className="bg-gradient-to-r from-[#ffeef5] to-[#fad2e6] rounded-2xl p-8 mb-8">
          <h1 className="text-3xl font-bold text-[#4a3f48] mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-[#8b7d84]">{category.description}</p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* 사이드바 - 카테고리 */}
          <aside className="lg:w-64 shrink-0">
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-24">
              <h2 className="font-bold text-[#4a3f48] mb-4">카테고리</h2>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/products"
                    className="block py-2 px-3 rounded-lg hover:bg-[#ffeef5] text-[#4a3f48] transition-colors"
                  >
                    전체 상품
                  </Link>
                </li>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={`/products/category/${cat.slug}`}
                      className={`block py-2 px-3 rounded-lg transition-colors ${
                        cat.slug === slug
                          ? "bg-[#ffeef5] text-[#ff6b9d] font-medium"
                          : "hover:bg-[#ffeef5] text-[#4a3f48]"
                      }`}
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* 메인 컨텐츠 */}
          <div className="flex-1">
            {/* 정렬 */}
            <div className="flex items-center justify-end mb-6">
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
                        href={`/products/category/${slug}?${new URLSearchParams(
                          {
                            ...search,
                            page: pageNum.toString(),
                          },
                        ).toString()}`}
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
                  이 카테고리에는 아직 상품이 없어요.
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
