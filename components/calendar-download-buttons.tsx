/**
 * @file components/calendar-download-buttons.tsx
 * @description 캘린더 배경화면 다운로드 버튼 컴포넌트
 *
 * 주요 기능:
 * 1. PC용 캘린더 다운로드 버튼
 * 2. 모바일용 캘린더 다운로드 버튼
 * 3. 캐릭터 이미지 다운로드 버튼
 * 4. 이미지 위에 오버레이로 배치
 */

"use client";

import { useState } from "react";
import { Download, Monitor, Smartphone, Heart } from "lucide-react";
import {
  downloadPCCalendar,
  downloadMobileCalendar,
  downloadCharacterImage,
} from "@/lib/utils/download-calendar";

export default function CalendarDownloadButtons() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (
    type: "pc" | "mobile" | "character",
    downloadFn: () => Promise<void>,
  ) => {
    if (downloading) return; // 이미 다운로드 중이면 무시

    setDownloading(type);
    console.log(`[CalendarDownloadButtons] ${type} 다운로드 시작`);

    try {
      await downloadFn();
    } catch (error) {
      console.error(`[CalendarDownloadButtons] ${type} 다운로드 실패:`, error);
      alert("다운로드 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
      {/* PC용 다운로드 버튼 */}
      <button
        onClick={() => handleDownload("pc", downloadPCCalendar)}
        disabled={!!downloading}
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        aria-label="PC용 캘린더 다운로드"
      >
        <Monitor className="w-4 h-4 text-[#ff6b9d] group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium text-[#4a3f48] whitespace-nowrap">
          {downloading === "pc" ? "다운로드 중..." : "PC 다운로드"}
        </span>
        <Download className="w-4 h-4 text-[#ff6b9d] group-hover:scale-110 transition-transform" />
      </button>

      {/* 모바일용 다운로드 버튼 */}
      <button
        onClick={() => handleDownload("mobile", downloadMobileCalendar)}
        disabled={!!downloading}
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        aria-label="모바일용 캘린더 다운로드"
      >
        <Smartphone className="w-4 h-4 text-[#ff6b9d] group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium text-[#4a3f48] whitespace-nowrap">
          {downloading === "mobile" ? "다운로드 중..." : "모바일 다운로드"}
        </span>
        <Download className="w-4 h-4 text-[#ff6b9d] group-hover:scale-110 transition-transform" />
      </button>

      {/* 캐릭터 이미지 다운로드 버튼 */}
      <button
        onClick={() => handleDownload("character", downloadCharacterImage)}
        disabled={!!downloading}
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        aria-label="캐릭터 이미지 다운로드"
      >
        <Heart className="w-4 h-4 text-[#ff6b9d] group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium text-[#4a3f48] whitespace-nowrap">
          {downloading === "character" ? "다운로드 중..." : "캐릭터 다운로드"}
        </span>
        <Download className="w-4 h-4 text-[#ff6b9d] group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}

