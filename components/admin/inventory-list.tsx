/**
 * @file components/admin/inventory-list.tsx
 * @description 재고 목록 및 수정 컴포넌트
 *
 * 주요 기능:
 * 1. 재고 목록 표시 (상품/옵션별)
 * 2. 재고 수정 (단건)
 * 3. 재고부족 필터
 * 4. 검색 기능
 *
 * @dependencies
 * - actions/admin: updateInventory
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, TrendingDown, Package, Filter } from "lucide-react";
import type { InventoryItem } from "@/actions/admin";
import { updateInventory } from "@/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logger from "@/lib/logger-client";

interface InventoryListProps {
  items: InventoryItem[];
  total: number;
  totalPages: number;
  currentPage: number;
  lowStockOnly: boolean;
  searchQuery?: string;
}

export default function InventoryList({
  items,
  totalPages,
  currentPage,
  lowStockOnly,
  searchQuery: initialSearchQuery,
}: InventoryListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || "");
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});

  const handleStockChange = (key: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      return;
    }
    setStockUpdates((prev) => ({
      ...prev,
      [key]: numValue,
    }));
  };

  const handleUpdateStock = async (item: InventoryItem) => {
    const key = item.variant_id || item.product_id;
    const newStock = stockUpdates[key];
    
    if (newStock === undefined) {
      return;
    }

    logger.group("[InventoryList] 재고 업데이트");
    logger.info(
      `[InventoryList] 상품: ${item.product_name}, 재고: ${newStock}, 옵션: ${item.variant_id || "없음"}`
    );

    startTransition(async () => {
      const result = await updateInventory(
        item.product_id,
        newStock,
        item.variant_id || undefined,
      );

      if (result.success) {
        logger.info("[InventoryList] ✅ 재고 업데이트 성공");
        // 업데이트된 재고 값 제거
        setStockUpdates((prev) => {
          const newState = { ...prev };
          delete newState[key];
          return newState;
        });
        router.refresh();
      } else {
        logger.error("[InventoryList] ❌ 재고 업데이트 실패:", result.message);
        alert(result.message);
      }
      logger.groupEnd();
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (lowStockOnly) {
      params.set("lowStock", "true");
    }
    params.set("page", "1");
    router.push(`/admin/inventory?${params.toString()}`);
  };

  const handleFilterToggle = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (!lowStockOnly) {
      params.set("lowStock", "true");
    }
    params.set("page", "1");
    router.push(`/admin/inventory?${params.toString()}`);
  };

  const getItemKey = (item: InventoryItem) => {
    return item.variant_id || item.product_id;
  };

  const getCurrentStock = (item: InventoryItem) => {
    return item.variant_stock ?? item.product_stock;
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-16 text-center">
        <Package className="w-16 h-16 text-[#8b7d84] mx-auto mb-4" />
        <p className="text-[#8b7d84] text-lg mb-2">
          {lowStockOnly ? "재고부족 상품이 없습니다." : "재고 항목이 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b7d84]" />
              <Input
                type="text"
                placeholder="상품명으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
              />
            </div>
            <Button
              type="submit"
              className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
            >
              검색
            </Button>
          </form>
          <Button
            onClick={handleFilterToggle}
            variant={lowStockOnly ? "default" : "outline"}
            className={lowStockOnly ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
          >
            <Filter className="w-4 h-4 mr-2" />
            재고부족만
          </Button>
        </div>
      </div>

      {/* 재고 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  상품명
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  옵션
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  카테고리
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  SKU
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  현재 재고
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  새 재고
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const key = getItemKey(item);
                const currentStock = getCurrentStock(item);
                const newStock = stockUpdates[key] ?? currentStock;

                return (
                  <tr
                    key={key}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${
                      item.is_low_stock ? "bg-orange-50" : ""
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/products/${item.product_id}`}
                          className="font-medium text-[#4a3f48] hover:text-[#ff6b9d] transition-colors"
                        >
                          {item.product_name}
                        </Link>
                        {item.is_low_stock && (
                          <TrendingDown className="w-4 h-4 text-orange-500" />
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[#8b7d84]">
                      {item.variant_name && item.variant_value
                        ? `${item.variant_name}: ${item.variant_value}`
                        : "-"}
                    </td>
                    <td className="py-4 px-4 text-[#8b7d84]">
                      {item.category_name || "-"}
                    </td>
                    <td className="py-4 px-4 text-[#8b7d84] font-mono text-xs">
                      {item.sku || "-"}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`font-medium ${
                          item.is_low_stock
                            ? "text-orange-600"
                            : "text-[#4a3f48]"
                        }`}
                      >
                        {currentStock}개
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <Input
                        type="number"
                        min="0"
                        value={newStock}
                        onChange={(e) => handleStockChange(key, e.target.value)}
                        className="w-24 bg-white border-gray-200"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <Button
                        onClick={() => handleUpdateStock(item)}
                        disabled={
                          isPending || newStock === currentStock || newStock < 0
                        }
                        size="sm"
                        className="bg-[#ff6b9d] hover:bg-[#ff5088] text-white"
                      >
                        수정
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const params = new URLSearchParams();
            if (searchQuery.trim()) {
              params.set("search", searchQuery.trim());
            }
            if (lowStockOnly) {
              params.set("lowStock", "true");
            }
            params.set("page", pageNum.toString());
            return (
              <Link
                key={pageNum}
                href={`/admin/inventory?${params.toString()}`}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors ${
                  pageNum === currentPage
                    ? "bg-[#ff6b9d] text-white"
                    : "bg-white text-[#4a3f48] hover:bg-[#ffeef5]"
                }`}
              >
                {pageNum}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
