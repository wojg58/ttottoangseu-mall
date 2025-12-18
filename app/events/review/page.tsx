/**
 * @file app/events/review/page.tsx
 * @description 리뷰 이벤트 페이지
 *
 * 주요 기능:
 * 1. 리뷰 이벤트 안내
 * 2. 이벤트 참여 방법 안내
 */

import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";

export default function ReviewEventPage() {
  console.log("[ReviewEventPage] 리뷰 이벤트 페이지 렌더링");

  return (
    <main className="min-h-screen bg-[#fff9f7] py-12">
      <div className="shop-container">
        {/* 뒤로가기 버튼 */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#4a3f48] hover:text-[#ff6b9d] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>홈으로 돌아가기</span>
        </Link>

        {/* 이벤트 헤더 */}
        <div className="bg-gradient-to-r from-[#ffd6e8] to-[#ffb6d5] rounded-2xl p-8 md:p-12 text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4">
            <Star className="w-10 h-10 text-[#ff6b9d]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-4">
            또또앙스 스토어 리뷰 이벤트
          </h1>
          <p className="text-lg text-black">
            상품구매 후기 작성 시 <strong className="text-[#ff5c9a]">1,000p</strong> 적립!
          </p>
        </div>

        {/* 이벤트 내용 */}
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm">
          <h2 className="text-2xl font-bold text-[#4a3f48] mb-6">
            이벤트 참여 방법
          </h2>
          <ol className="space-y-4 mb-8">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-[#ffeef5] text-[#ff6b9d] rounded-full flex items-center justify-center font-bold">
                1
              </span>
              <div>
                <p className="text-[#4a3f48] font-medium mb-1">
                  상품 구매하기
                </p>
                <p className="text-[#8b7d84] text-sm">
                  또또앙스 스토어에서 원하는 상품을 구매해주세요.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-[#ffeef5] text-[#ff6b9d] rounded-full flex items-center justify-center font-bold">
                2
              </span>
              <div>
                <p className="text-[#4a3f48] font-medium mb-1">
                  구매 후기 작성하기
                </p>
                <p className="text-[#8b7d84] text-sm">
                  상품 페이지에서 구매 후기를 작성해주세요.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-[#ffeef5] text-[#ff6b9d] rounded-full flex items-center justify-center font-bold">
                3
              </span>
              <div>
                <p className="text-[#4a3f48] font-medium mb-1">
                  포인트 적립받기
                </p>
                <p className="text-[#8b7d84] text-sm">
                  후기 작성 완료 시 자동으로 <strong className="text-[#ff5c9a]">1,000p</strong>가 적립됩니다.
                </p>
              </div>
            </li>
          </ol>

          <div className="bg-[#ffeef5] rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold text-[#4a3f48] mb-2">
              이벤트 안내
            </h3>
            <ul className="space-y-2 text-sm text-[#8b7d84]">
              <li>• 이벤트는 상품 구매 후에만 참여 가능합니다.</li>
              <li>• 후기는 구매한 상품 페이지에서 작성할 수 있습니다.</li>
              <li>• 포인트는 후기 작성 후 즉시 적립됩니다.</li>
              <li>• 적립된 포인트는 다음 구매 시 사용할 수 있습니다.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/products"
              className="shop-btn-accent inline-flex items-center justify-center gap-2 text-center"
            >
              상품 보러가기
            </Link>
            <Link
              href="/mypage"
              className="shop-btn-primary inline-flex items-center justify-center gap-2 text-center"
            >
              내 포인트 확인하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

