/**
 * @file components/all-products-section.tsx
 * @description 전체상품 섹션 (PR_01부터 PR_20까지 20개 표시)
 *
 * 주요 기능:
 * 1. 한 줄에 5개씩 상품 표시 (총 4줄)
 * 2. PR_01부터 PR_20까지 정렬된 상품 표시
 */

import ProductCard from "@/components/product-card";
import type { ProductListItem } from "@/types/database";

interface AllProductsSectionProps {
  initialProducts: ProductListItem[];
}

export default function AllProductsSection({
  initialProducts,
}: AllProductsSectionProps) {
  // slug 숫자 기준으로 정렬 (PR_01부터 PR_20까지)
  const sortedProducts = [...initialProducts].sort((a, b) => {
    const slugA = a.slug || "";
    const slugB = b.slug || "";

    // slug에서 숫자 부분 추출 (예: "PR_01" -> 1, "PR_20" -> 20)
    const extractNumber = (slug: string): number => {
      const match = slug.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const numA = extractNumber(slugA);
    const numB = extractNumber(slugB);

    // 숫자가 같으면 slug 전체로 정렬
    if (numA === numB) {
      return slugA.localeCompare(slugB);
    }

    return numA - numB;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      {sortedProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

