/**
 * @file components/product-sort-select.tsx
 * @description 상품 정렬 선택 컴포넌트
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import logger from "@/lib/logger-client";

interface ProductSortSelectProps {
  defaultValue: "newest" | "price_asc" | "price_desc" | "name";
}

export default function ProductSortSelect({
  defaultValue,
}: ProductSortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    logger.debug("[ProductSortSelect] 정렬 변경");

    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set("sort", e.target.value);
    router.push(`?${newSearchParams.toString()}`);
  };

  return (
    <div className="relative">
      <select
        defaultValue={defaultValue}
        onChange={handleChange}
        className="appearance-none bg-white border border-[#f5d5e3] rounded-lg py-2 pl-4 pr-10 text-sm text-[#4a3f48] focus:outline-none focus:ring-2 focus:ring-[#fad2e6]"
      >
        <option value="newest">최신순</option>
        <option value="price_asc">가격 낮은순</option>
        <option value="price_desc">가격 높은순</option>
        <option value="name">이름순</option>
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b7d84] pointer-events-none" />
    </div>
  );
}

