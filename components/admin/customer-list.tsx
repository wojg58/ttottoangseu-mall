/**
 * @file components/admin/customer-list.tsx
 * @description 회원 목록 컴포넌트
 *
 * 주요 기능:
 * 1. 회원 목록 표시
 * 2. 검색 기능
 * 3. 정렬 기능
 * 4. 회원 상세 링크
 *
 * @dependencies
 * - actions/admin: CustomerListItem
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, User, Mail, Phone, ShoppingBag, DollarSign, Calendar } from "lucide-react";
import type { CustomerListItem } from "@/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import NumberDisplay from "@/components/number-display";
import DateDisplay from "@/components/date-display";

interface CustomerListProps {
  customers: CustomerListItem[];
  total: number;
  totalPages: number;
  currentPage: number;
  searchQuery?: string;
  sortBy: string;
}

export default function CustomerList({
  customers,
  totalPages,
  currentPage,
  searchQuery: initialSearchQuery,
  sortBy: initialSortBy,
}: CustomerListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    params.set("sort", initialSortBy);
    params.set("page", "1");
    router.push(`/admin/customers?${params.toString()}`);
  };

  const handleSortChange = (newSortBy: string) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    params.set("sort", newSortBy);
    params.set("page", "1");
    router.push(`/admin/customers?${params.toString()}`);
  };

  if (customers.length === 0) {
    return (
      <div className="space-y-6">
        {/* 검색 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b7d84]" />
              <Input
                type="text"
                placeholder="이름, 이메일, 전화번호로 검색..."
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
        </div>

        <div className="bg-white rounded-xl shadow-sm p-16 text-center">
          <User className="w-16 h-16 text-[#8b7d84] mx-auto mb-4" />
          <p className="text-[#8b7d84] text-lg mb-2">회원이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 정렬 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b7d84]" />
              <Input
                type="text"
                placeholder="이름, 이메일, 전화번호로 검색..."
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#8b7d84]">정렬:</span>
            <select
              value={initialSortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-[#ff6b9d] focus:ring-[#ff6b9d]"
            >
              <option value="created_at">가입일 최신순</option>
              <option value="name">이름 가나다순</option>
              <option value="email">이메일순</option>
              <option value="order_count">주문횟수 많은순</option>
              <option value="total_spent">총구매액 많은순</option>
              <option value="last_order">최근주문일순</option>
            </select>
          </div>
        </div>
      </div>

      {/* 회원 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  이름
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  이메일
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  전화번호
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  주문횟수
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  총구매액
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  최근주문
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  가입일
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#8b7d84]" />
                      <span className="font-medium text-[#4a3f48]">
                        {customer.name || "이름 없음"}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#8b7d84]">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#8b7d84]">
                    {customer.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {customer.phone}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[#8b7d84]" />
                      <span className="text-[#4a3f48] font-medium">
                        {customer.order_count}건
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <NumberDisplay
                        value={customer.total_spent}
                        suffix="원"
                        className="text-[#4a3f48] font-medium"
                      />
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#8b7d84]">
                    {customer.last_order_at ? (
                      <DateDisplay date={customer.last_order_at} format="date" />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-4 px-4 text-[#8b7d84]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <DateDisplay date={customer.created_at} format="date" />
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="text-[#ff6b9d] hover:underline text-sm"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
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
            params.set("sort", initialSortBy);
            params.set("page", pageNum.toString());
            return (
              <Link
                key={pageNum}
                href={`/admin/customers?${params.toString()}`}
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
