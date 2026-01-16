/**
 * @file components/admin/coupon-list.tsx
 * @description 쿠폰 목록 컴포넌트
 *
 * 주요 기능:
 * 1. 쿠폰 목록 표시
 * 2. 검색 기능
 * 3. 상태 필터
 *
 * @dependencies
 * - actions/admin: AdminCoupon
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Tag, User, Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { AdminCoupon } from "@/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import NumberDisplay from "@/components/number-display";
import DateDisplay from "@/components/date-display";

interface CouponListProps {
  coupons: AdminCoupon[];
  total: number;
  totalPages: number;
  currentPage: number;
  status?: string;
  searchQuery?: string;
}

export default function CouponList({
  coupons,
  total,
  totalPages,
  currentPage,
  status: initialStatus,
  searchQuery: initialSearchQuery,
}: CouponListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (initialStatus) {
      params.set("status", initialStatus);
    }
    params.set("page", "1");
    router.push(`/admin/promotions?${params.toString()}`);
  };

  const handleStatusFilter = (newStatus: string | undefined) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (newStatus) {
      params.set("status", newStatus);
    }
    params.set("page", "1");
    router.push(`/admin/promotions?${params.toString()}`);
  };

  const formatDiscount = (coupon: AdminCoupon): React.ReactNode => {
    if (coupon.discount_type === "fixed") {
      return (
        <span>
          <NumberDisplay value={coupon.discount_amount} suffix="원" /> 할인
        </span>
      );
    } else {
      return (
        <span>
          {coupon.discount_amount}% 할인
          {coupon.max_discount_amount && (
            <span className="text-xs text-[#8b7d84] block">
              (최대 <NumberDisplay value={coupon.max_discount_amount} suffix="원" />)
            </span>
          )}
        </span>
      );
    }
  };

  if (coupons.length === 0) {
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
                  placeholder="쿠폰 코드, 이름으로 검색..."
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
              <button
                onClick={() => handleStatusFilter(undefined)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  !initialStatus
                    ? "bg-[#ff6b9d] text-white"
                    : "bg-white text-[#4a3f48] hover:bg-gray-50"
                }`}
              >
                전체
              </button>
              <button
                onClick={() => handleStatusFilter("active")}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  initialStatus === "active"
                    ? "bg-green-500 text-white"
                    : "bg-white text-[#4a3f48] hover:bg-gray-50"
                }`}
              >
                사용가능
              </button>
              <button
                onClick={() => handleStatusFilter("used")}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  initialStatus === "used"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-[#4a3f48] hover:bg-gray-50"
                }`}
              >
                사용됨
              </button>
              <button
                onClick={() => handleStatusFilter("expired")}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  initialStatus === "expired"
                    ? "bg-gray-500 text-white"
                    : "bg-white text-[#4a3f48] hover:bg-gray-50"
                }`}
              >
                만료됨
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-16 text-center">
          <Tag className="w-16 h-16 text-[#8b7d84] mx-auto mb-4 opacity-50" />
          <p className="text-[#8b7d84] text-lg mb-2">쿠폰이 없습니다.</p>
        </div>
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
                placeholder="쿠폰 코드, 이름으로 검색..."
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
            <button
              onClick={() => handleStatusFilter(undefined)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                !initialStatus
                  ? "bg-[#ff6b9d] text-white"
                  : "bg-white text-[#4a3f48] hover:bg-gray-50"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => handleStatusFilter("active")}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                initialStatus === "active"
                  ? "bg-green-500 text-white"
                  : "bg-white text-[#4a3f48] hover:bg-gray-50"
              }`}
            >
              사용가능
            </button>
            <button
              onClick={() => handleStatusFilter("used")}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                initialStatus === "used"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-[#4a3f48] hover:bg-gray-50"
              }`}
            >
              사용됨
            </button>
            <button
              onClick={() => handleStatusFilter("expired")}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                initialStatus === "expired"
                  ? "bg-gray-500 text-white"
                  : "bg-white text-[#4a3f48] hover:bg-gray-50"
              }`}
            >
              만료됨
            </button>
          </div>
        </div>
      </div>

      {/* 쿠폰 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  쿠폰 코드
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  쿠폰명
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  할인
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  회원
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  상태
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  만료일
                </th>
                <th className="text-left py-4 px-4 text-[#8b7d84] font-medium">
                  사용일
                </th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const isExpired = new Date(coupon.expires_at) < new Date();
                const displayStatus =
                  coupon.status === "expired" || isExpired
                    ? "expired"
                    : coupon.status;

                return (
                  <tr
                    key={coupon.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[#ff6b9d]" />
                        <span className="font-mono font-medium text-[#4a3f48]">
                          {coupon.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[#4a3f48]">{coupon.name}</td>
                    <td className="py-4 px-4 text-[#4a3f48]">
                      {formatDiscount(coupon)}
                      {coupon.min_order_amount && (
                        <span className="text-xs text-[#8b7d84] block">
                          최소 주문:{" "}
                          <NumberDisplay
                            value={coupon.min_order_amount}
                            suffix="원"
                          />
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-[#8b7d84]">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {coupon.user_name || coupon.user_email || "-"}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          displayStatus === "active"
                            ? "bg-green-100 text-green-600"
                            : displayStatus === "used"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {displayStatus === "active" && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            사용가능
                          </div>
                        )}
                        {displayStatus === "used" && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            사용됨
                          </div>
                        )}
                        {displayStatus === "expired" && (
                          <div className="flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            만료됨
                          </div>
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#8b7d84]">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <DateDisplay date={coupon.expires_at} format="date" />
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[#8b7d84]">
                      {coupon.used_at ? (
                        <DateDisplay date={coupon.used_at} format="date" />
                      ) : (
                        "-"
                      )}
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
            if (initialStatus) {
              params.set("status", initialStatus);
            }
            params.set("page", pageNum.toString());
            return (
              <Link
                key={pageNum}
                href={`/admin/promotions?${params.toString()}`}
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
