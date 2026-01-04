/**
 * @file components/category-section.tsx
 * @description 카테고리 섹션 컴포넌트
 *
 * 주요 기능:
 * 1. 카테고리 목록 표시
 * 2. 카테고리 클릭 시 상품 표시
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import type { Category } from "@/types/database";
import CategoryProductsSection from "./category-products-section";

// 카테고리별 이모지 매핑
const CATEGORY_EMOJI: Record<string, string> = {
  sanrio: "❤️",
  character: "🧡",
  "phone-strap": "💛",
  fashion: "💙",
  bear: "💜",
};

interface CategorySectionProps {
  categories: Category[];
}

export default function CategorySection({ categories }: CategorySectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategoryClick = (categorySlug: string) => {
    console.log("[CategorySection] 카테고리 클릭:", categorySlug);
    // 같은 카테고리를 다시 클릭하면 닫기
    if (selectedCategory === categorySlug) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categorySlug);
    }
  };

  return (
    <>
      {/* 카테고리 섹션 */}
      {categories.length > 0 && (
        <div className="py-12">
          <div className="shop-container">
            <h2 className="text-2xl font-bold text-black text-center mb-8">
              카테고리
            </h2>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.slug)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-white/90 backdrop-blur-sm border border-white/50 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 group ${
                    selectedCategory === category.slug
                      ? "ring-2 ring-[#ff6b9d] bg-[#ffeef5]"
                      : ""
                  }`}
                >
                  <div className="w-16 h-16 bg-[#ffeef5] group-hover:bg-[#fad2e6] rounded-full flex items-center justify-center transition-colors shadow-sm">
                    {category.slug === "best" ? (
                      <Image
                        src="/best.png"
                        alt="베스트"
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <span className="text-2xl">
                        {CATEGORY_EMOJI[category.slug] || "📦"}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-black text-center font-medium">
                    {category.name.replace(/[❤️🧡💛💚💙🤎💜]/g, "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 카테고리별 상품 섹션 */}
      <CategoryProductsSection
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
    </>
  );
}

