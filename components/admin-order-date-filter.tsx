/**
 * @file components/admin-order-date-filter.tsx
 * @description 관리자 주문 관리 페이지 날짜 필터 컴포넌트
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import logger from "@/lib/logger-client";

export default function AdminOrderDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // URL에서 날짜 파라미터 가져오기
  const startDateFromUrl = searchParams.get("startDate") || "";
  const endDateFromUrl = searchParams.get("endDate") || "";

  const [startDate, setStartDate] = useState(startDateFromUrl);
  const [endDate, setEndDate] = useState(endDateFromUrl);

  const handleApply = () => {
    startTransition(() => {
      const newSearchParams = new URLSearchParams(searchParams.toString());

      // 날짜 파라미터 추가/제거
      if (startDate) {
        newSearchParams.set("startDate", startDate);
      } else {
        newSearchParams.delete("startDate");
      }

      if (endDate) {
        newSearchParams.set("endDate", endDate);
      } else {
        newSearchParams.delete("endDate");
      }

      // 페이지는 1로 리셋
      newSearchParams.set("page", "1");

      router.push(`/admin/orders?${newSearchParams.toString()}`);
    });
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");

    startTransition(() => {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("startDate");
      newSearchParams.delete("endDate");
      newSearchParams.set("page", "1");

      router.push(`/admin/orders?${newSearchParams.toString()}`);
    });
  };

  const handleDownload = () => {
    logger.debug("[AdminOrderDateFilter] 엑셀 다운로드 시작");

    const downloadParams = new URLSearchParams();
    const currentStatus = searchParams.get("status");

    if (currentStatus) {
      downloadParams.set("paymentStatus", currentStatus);
    }

    if (startDate) {
      downloadParams.set("startDate", startDate);
    }

    if (endDate) {
      downloadParams.set("endDate", endDate);
    }

    const url = `/api/admin/orders/export?${downloadParams.toString()}`;
    window.location.href = url;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-[#ff6b9d]" />
        <h3 className="font-medium text-[#4a3f48]">기간별 조회</h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm text-[#8b7d84] mb-2">
            시작일
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 border border-[#f5d5e3] rounded-lg text-sm text-[#4a3f48] focus:outline-none focus:ring-2 focus:ring-[#fad2e6]"
            disabled={isPending}
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm text-[#8b7d84] mb-2">
            종료일
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
            className="w-full px-4 py-2 border border-[#f5d5e3] rounded-lg text-sm text-[#4a3f48] focus:outline-none focus:ring-2 focus:ring-[#fad2e6]"
            disabled={isPending}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleApply}
            disabled={isPending}
            className="bg-[#ff6b9d] text-white hover:bg-[#ff5a8a] disabled:opacity-50"
          >
            적용
          </Button>
          {(startDate || endDate) && (
            <Button
              onClick={handleReset}
              disabled={isPending}
              variant="outline"
              className="border-[#f5d5e3] text-[#4a3f48] hover:bg-[#ffeef5] disabled:opacity-50"
            >
              초기화
            </Button>
          )}
          <Button
            onClick={handleDownload}
            disabled={isPending}
            variant="outline"
            className="border-green-500 text-green-600 hover:bg-green-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </Button>
        </div>
      </div>

      {(startDate || endDate) && (
        <div className="mt-4 pt-4 border-t border-[#f5d5e3]">
          <p className="text-sm text-[#8b7d84]">
            조회 기간:{" "}
            <span className="text-[#4a3f48] font-medium">
              {startDate || "전체"} ~ {endDate || "전체"}
            </span>
            <span className="ml-2 text-xs text-[#8b7d84]">
              (결제 완료일 기준)
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

