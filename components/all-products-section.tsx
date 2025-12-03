/**
 * @file components/all-products-section.tsx
 * @description 전체상품 섹션 (무한 스크롤)
 *
 * 주요 기능:
 * 1. 한 줄에 5개씩 상품 표시
 * 2. 스크롤 시 자동으로 추가 상품 로드 (10줄, 총 50개)
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ProductCard from "@/components/product-card";
import type { ProductListItem } from "@/types/database";

interface AllProductsSectionProps {
  initialProducts: ProductListItem[];
}

export default function AllProductsSection({
  initialProducts,
}: AllProductsSectionProps) {
  const [products, setProducts] = useState<ProductListItem[]>(initialProducts);
  const [page, setPage] = useState(2); // 초기 5개는 이미 로드됨
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadMoreProducts = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    console.log("[AllProductsSection] 추가 상품 로드 중...", page);

    try {
      const response = await fetch(
        `/api/products?page=${page}&limit=5`,
      );
      const data = await response.json();

      if (data.products && data.products.length > 0) {
        setProducts((prev) => [...prev, ...data.products]);
        setPage((prev) => prev + 1);
        // 총 50개까지만 로드 (10줄 x 5개)
        if (products.length + data.products.length >= 50) {
          setHasMore(false);
        } else if (!data.hasMore) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("[AllProductsSection] 상품 로드 에러:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading, hasMore, products.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1 },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loadMoreProducts, hasMore, isLoading]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {hasMore && (
        <div ref={observerTarget} className="h-20 flex items-center justify-center">
          {isLoading && (
            <div className="text-[#8b7d84] text-sm">상품을 불러오는 중...</div>
          )}
        </div>
      )}
    </>
  );
}

