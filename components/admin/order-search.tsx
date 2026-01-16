/**
 * @file components/admin/order-search.tsx
 * @description 관리자 주문 검색 컴포넌트
 *
 * 주요 기능:
 * - 주문번호, 고객명, 전화번호로 검색
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
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OrderSearch() {
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
      params.set("page", "1");
    }

    router.push(`/admin/orders?${params.toString()}`);
  };

  const handleClear = () => {
    setSearchQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    params.set("page", "1");
    router.push(`/admin/orders?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="mb-6">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b7d84]" />
          <Input
            type="text"
            placeholder="주문번호, 고객명, 전화번호로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-white border-gray-200 focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          type="submit"
          className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
        >
          검색
        </Button>
      </div>
    </form>
  );
}
