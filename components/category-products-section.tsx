/**
 * @file components/category-products-section.tsx
 * @description 카테고리별 상품 표시 섹션
 *
 * 주요 기능:
 * 1. 카테고리 클릭 시 해당 카테고리 상품 표시
 * 2. 한 줄에 4개씩, 최대 10줄 (40개 상품) 표시
 * 3. 스크롤 가능한 그리드 레이아웃
 */

"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getProducts } from "@/actions/products";
import ProductCard from "@/components/product-card";
import type { ProductListItem, Category } from "@/types/database";

interface CategoryProductsSectionProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export default function CategoryProductsSection({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryProductsSectionProps) {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 선택된 카테고리가 변경될 때마다 상품 로드
  useEffect(() => {
    if (!selectedCategory) {
      setProducts([]);
      return;
    }

    const loadProducts = async () => {
      console.log("[CategoryProductsSection] 상품 로드 시작:", selectedCategory);
      setIsLoading(true);

      try {
        // 카테고리별 상품 가져오기 (최대 40개)
        const result = await getProducts(
          { categorySlug: selectedCategory },
          1,
          40 // 한 줄에 4개씩 10줄 = 40개
        );

        console.log("[CategoryProductsSection] 상품 로드 완료:", {
          category: selectedCategory,
          count: result.data.length,
          total: result.total,
        });

        setProducts(result.data);
      } catch (error) {
        console.error("[CategoryProductsSection] 상품 로드 에러:", error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [selectedCategory]);

  // 카테고리 이름 가져오기
  const getCategoryName = (slug: string) => {
    const category = categories.find((cat) => cat.slug === slug);
    return category?.name || slug;
  };

  // 선택된 카테고리가 없으면 아무것도 표시하지 않음
  if (!selectedCategory) {
    return null;
  }

  return (
    <section className="py-8 bg-white/50 backdrop-blur-sm">
      <div className="shop-container">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#ff6b9d]">
              {getCategoryName(selectedCategory)}
            </h2>
            <p className="text-sm text-pink-500 mt-1">
              {products.length > 0
                ? `총 ${products.length}개의 상품`
                : "상품을 불러오는 중..."}
            </p>
          </div>
          <button
            onClick={() => {
              onCategoryChange(null);
            }}
            className="p-2 hover:bg-[#ffeef5] rounded-full transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-[#ff6b9d]" />
          </button>
        </div>

        {/* 상품 그리드 (한 줄에 4개, 최대 10줄, 스크롤 가능) */}
        <div className="max-h-[1200px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d]"></div>
              <p className="mt-4 text-[#8b7d84]">상품을 불러오는 중...</p>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 pb-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#ffeef5] rounded-xl">
              <span className="text-4xl mb-4 block">📦</span>
              <p className="text-[#8b7d84]">이 카테고리에 상품이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

