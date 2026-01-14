/**
 * @file components/admin/product-search.tsx
 * @description 관리자 상품 검색 컴포넌트
 *
 * 주요 기능:
 * - 상품명으로 검색
 * - URL 쿼리 파라미터로 검색어 전달
 *
 * @dependencies
 * - next/navigation: useRouter, useSearchParams
 * - lucide-react: Search 아이콘
 * - components/ui/input: Input 컴포넌트
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  // URL에서 검색어 가져오기
  useEffect(() => {
    const query = searchParams.get("search") || "";
    setSearchQuery(query);
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams(searchParams.toString());
    
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
      params.set("page", "1"); // 검색 시 첫 페이지로 이동
    } else {
      params.delete("search");
      params.delete("page");
    }

    router.push(`/admin/products?${params.toString()}`);
  };

  const handleClear = () => {
    setSearchQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.delete("page");
    router.push(`/admin/products?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex items-center gap-2 mb-6">
      <div className="relative flex-1 max-w-md">
        <Input
          type="text"
          placeholder="상품명으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-4 pr-10"
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
      {searchQuery && (
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          className="text-sm"
        >
          초기화
        </Button>
      )}
    </form>
  );
}

