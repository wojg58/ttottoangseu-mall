/**
 * @file components/admin/analytics-dashboard.tsx
 * @description 통계 대시보드 컴포넌트
 *
 * 주요 기능:
 * 1. 기간별 매출 카드
 * 2. 베스트 상품 목록
 * 3. 취소율 표시
 * 4. 주문 통계
 *
 * @dependencies
 * - actions/admin: AnalyticsData
 */

"use client";

import { DollarSign, ShoppingBag, TrendingUp, TrendingDown, Package } from "lucide-react";
import type { AnalyticsData } from "@/actions/admin";
import NumberDisplay from "@/components/number-display";
import Link from "next/link";

interface AnalyticsDashboardProps {
  data: AnalyticsData;
}

export default function AnalyticsDashboard({
  data,
}: AnalyticsDashboardProps) {
  const revenueChange =
    data.revenueLastMonth > 0
      ? ((data.revenueThisMonth - data.revenueLastMonth) /
          data.revenueLastMonth) *
        100
      : 0;

  return (
    <div className="space-y-8">
      {/* 매출 통계 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-xs text-green-500">오늘</span>
          </div>
          <NumberDisplay
            value={data.revenueToday}
            suffix="원"
            className="text-2xl font-bold text-[#4a3f48]"
          />
          <p className="text-sm text-[#8b7d84] mt-1">오늘 매출</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-xs text-blue-500">7일</span>
          </div>
          <NumberDisplay
            value={data.revenue7Days}
            suffix="원"
            className="text-2xl font-bold text-[#4a3f48]"
          />
          <p className="text-sm text-[#8b7d84] mt-1">7일 매출</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-xs text-purple-500">30일</span>
          </div>
          <NumberDisplay
            value={data.revenue30Days}
            suffix="원"
            className="text-2xl font-bold text-[#4a3f48]"
          />
          <p className="text-sm text-[#8b7d84] mt-1">30일 매출</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              {revenueChange >= 0 ? (
                <TrendingUp className="w-6 h-6 text-indigo-500" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-500" />
              )}
            </div>
            <span className="text-xs text-indigo-500">이번 달</span>
          </div>
          <div>
            <NumberDisplay
              value={data.revenueThisMonth}
              suffix="원"
              className="text-2xl font-bold text-[#4a3f48]"
            />
            {data.revenueLastMonth > 0 && (
              <p
                className={`text-sm mt-1 ${
                  revenueChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {revenueChange >= 0 ? "+" : ""}
                {revenueChange.toFixed(1)}% (지난 달 대비)
              </p>
            )}
          </div>
          <p className="text-sm text-[#8b7d84] mt-1">이번 달 매출</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 주문 통계 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-[#4a3f48] mb-4">주문 통계</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#8b7d84]" />
                <span className="text-[#4a3f48]">오늘</span>
              </div>
              <span className="text-lg font-bold text-[#4a3f48]">
                {data.ordersToday}건
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#8b7d84]" />
                <span className="text-[#4a3f48]">7일</span>
              </div>
              <span className="text-lg font-bold text-[#4a3f48]">
                {data.orders7Days}건
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#8b7d84]" />
                <span className="text-[#4a3f48]">30일</span>
              </div>
              <span className="text-lg font-bold text-[#4a3f48]">
                {data.orders30Days}건
              </span>
            </div>
          </div>
        </div>

        {/* 취소/환불 통계 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-[#4a3f48] mb-4">취소/환불 통계</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#8b7d84]">7일 취소율</span>
                <span className="text-lg font-bold text-[#4a3f48]">
                  {data.cancelRate7Days.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8b7d84]">
                  취소: {data.canceled7Days}건
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#8b7d84]">30일 취소율</span>
                <span className="text-lg font-bold text-[#4a3f48]">
                  {data.cancelRate30Days.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8b7d84]">
                  취소: {data.canceled30Days}건, 환불: {data.refunded30Days}건
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 베스트 상품 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-bold text-[#4a3f48] mb-4">베스트 상품 (30일 판매량 기준)</h2>
        {data.bestProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                    순위
                  </th>
                  <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                    상품명
                  </th>
                  <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                    판매량
                  </th>
                  <th className="text-left py-3 px-2 text-[#8b7d84] font-medium">
                    매출
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.bestProducts.map((product, index) => (
                  <tr
                    key={product.product_id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <TrendingUp className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="font-medium text-[#4a3f48]">
                          {index + 1}위
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <Link
                        href={`/products/${product.product_id}`}
                        className="text-[#ff6b9d] hover:underline"
                      >
                        {product.product_name}
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-[#4a3f48] font-medium">
                      {product.total_quantity}개
                    </td>
                    <td className="py-3 px-2 text-[#4a3f48] font-medium">
                      <NumberDisplay value={product.total_revenue} suffix="원" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-[#8b7d84]">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>판매 데이터가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
