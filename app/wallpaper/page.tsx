/**
 * @file app/wallpaper/page.tsx
 * @description 배경화면 다운로드 페이지
 *
 * 주요 기능:
 * 1. 모바일/PC용 배경화면 다운로드 제공
 * 2. 이미지 미리보기
 */

import Image from "next/image";
import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";

export default function WallpaperDownloadPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 to-blue-50 py-12 px-4">
      <div className="max-w-[1221px] mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#4a3f48] hover:text-[#ff6b9d] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>홈으로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold text-[#4a3f48] mb-2">
            1월 배경화면 다운로드
          </h1>
          <p className="text-[#4a3f48]/80">
            스마트폰/PC에 저장해서 예쁘게 써보세요 💗
          </p>
        </div>

        {/* 다운로드 섹션 */}
        <div className="grid md:grid-cols-5 gap-6">
          {/* 모바일용 - 세로로 길게 */}
          <div className="bg-white rounded-xl shadow-md p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-[#4a3f48] mb-4">
              모바일용 배경화면
            </h2>
            <div className="relative aspect-[9/19.5] mb-4 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src="/image/calendar_mobile_02.png"
                alt="모바일용 배경화면"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </div>
            <a
              href="/image/calendar_mobile_jp.jpg"
              download
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#ff6b9d] text-white rounded-lg font-bold hover:bg-[#ff5088] transition-colors"
            >
              <Download className="w-5 h-5" />
              MOBILE 다운로드
            </a>
          </div>

          {/* PC용 - 넓게 구현 */}
          <div className="bg-white rounded-xl shadow-md p-6 md:col-span-3">
            <h2 className="text-xl font-bold text-[#4a3f48] mb-4">
              PC용 배경화면
            </h2>
            <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src="/image/calendar_pc_jp.jpg"
                alt="PC용 배경화면"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 60vw"
              />
            </div>
            <a
              href="/image/calendar_pc_jp.jpg"
              download
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#ff6b9d] text-white rounded-lg font-bold hover:bg-[#ff5088] transition-colors mb-[1.5cm]"
            >
              <Download className="w-5 h-5" />
              PC 다운로드
            </a>
            
            {/* PC용 배경화면 (달력X) */}
            <h3 className="text-lg font-bold text-[#4a3f48] mb-4">
              PC용 배경화면 (달력X)
            </h3>
            <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src="/image/ChatGPT_01_jp.jpg"
                alt="PC용 배경화면 (달력X)"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 60vw"
              />
            </div>
            <a
              href="/image/ChatGPT_01_jp.jpg"
              download
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#ff6b9d] text-white rounded-lg font-bold hover:bg-[#ff5088] transition-colors"
            >
              <Download className="w-5 h-5" />
              PC 다운로드 (달력X)
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

