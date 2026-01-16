/**
 * @file components/admin/product-filters.tsx
 * @description 관리자 상품 필터 컴포넌트
 *
 * 주요 기능:
 * - 카테고리 필터
 * - 노출 상태 필터
 * - 재고 상태 필터
 * - 정렬 옵션
 *
 * @dependencies
 * - next/navigation: useRouter, useSearchParams
 * - actions/products: getCategories
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { getCategories } from "@/actions/products";
import type { Category } from "@/types/database";

export default function ProductFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // URL에서 필터 값 가져오기
  const categoryId = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";
  const stockFilter = searchParams.get("stock") || "";
  const sortBy = searchParams.get("sort") || "created_at";

  // 카테고리 목록 로드
  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (error) {
        console.error("카테고리 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadCategories();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    params.set("page", "1"); // 필터 변경 시 첫 페이지로
    router.push(`/admin/products?${params.toString()}`);
  };

  const handleClearAll = () => {
    const params = new URLSearchParams();
    const search = searchParams.get("search");
    if (search) {
      params.set("search", search);
    }
    params.set("page", "1");
    router.push(`/admin/products?${params.toString()}`);
  };

  const hasActiveFilters = categoryId || status || stockFilter || (sortBy && sortBy !== "created_at");

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#8b7d84]" />
          <span className="text-sm font-medium text-[#4a3f48]">필터</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-sm text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
          >
            <X className="w-4 h-4" />
            필터 초기화
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        {/* 카테고리 필터 */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-[#8b7d84] mb-1">카테고리</label>
          <select
            value={categoryId}
            onChange={(e) => handleFilterChange("category", e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
            disabled={isLoading}
          >
            <option value="">전체</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* 노출 상태 필터 */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs text-[#8b7d84] mb-1">노출 상태</label>
          <select
            value={status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
          >
            <option value="">전체</option>
            <option value="active">노출</option>
            <option value="hidden">숨김</option>
            <option value="sold_out">품절</option>
          </select>
        </div>

        {/* 재고 필터 */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs text-[#8b7d84] mb-1">재고 상태</label>
          <select
            value={stockFilter}
            onChange={(e) => handleFilterChange("stock", e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
          >
            <option value="">전체</option>
            <option value="low">재고부족 (10개 이하)</option>
            <option value="out">품절 (0개)</option>
          </select>
        </div>

        {/* 정렬 */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs text-[#8b7d84] mb-1">정렬</label>
          <select
            value={sortBy}
            onChange={(e) => handleFilterChange("sort", e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
          >
            <option value="created_at">등록일 최신순</option>
            <option value="name">상품명 가나다순</option>
            <option value="price_asc">가격 낮은순</option>
            <option value="price_desc">가격 높은순</option>
            <option value="stock_asc">재고 적은순</option>
            <option value="stock_desc">재고 많은순</option>
            <option value="id">ID 순서</option>
          </select>
        </div>
      </div>
    </div>
  );
}
