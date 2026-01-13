/**
 * @file app/events/signup/page.tsx
 * @description 신규가입 쿠폰 이벤트 페이지
 *
 * 주요 기능:
 * 1. 신규가입 쿠폰 이벤트 안내
 * 2. 이벤트 참여 방법 안내
 */

import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";
import { logger } from "@/lib/logger";

export default function SignupEventPage() {
  logger.debug("[SignupEventPage] 신규가입 쿠폰 이벤트 페이지 렌더링");

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
        <div className="bg-gradient-to-r from-[#bbf7d0] to-[#86efac] rounded-2xl p-8 md:p-12 text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4">
            <Gift className="w-10 h-10 text-[#ff6b9d]" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-4">
            신규가입 시 1천원 쿠폰 증정
          </h1>
          <p className="text-lg text-black">
            신규가입하고 <strong className="text-[#ff5c9a]">1,000원</strong> 할인받자!
          </p>
        </div>

        {/* 이벤트 내용 */}
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm">
          <h2 className="text-2xl font-bold text-[#4a3f48] mb-6">
            이벤트 참여 방법
          </h2>
          <ol className="space-y-4 mb-8">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-[#bbf7d0] text-[#4a3f48] rounded-full flex items-center justify-center font-bold">
                1
              </span>
              <div>
                <p className="text-[#4a3f48] font-medium mb-1">
                  회원가입하기
                </p>
                <p className="text-[#8b7d84] text-sm">
                  또또앙스 스토어에 신규 회원으로 가입해주세요.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-[#bbf7d0] text-[#4a3f48] rounded-full flex items-center justify-center font-bold">
                2
              </span>
              <div>
                <p className="text-[#4a3f48] font-medium mb-1">
                  쿠폰 받기
                </p>
                <p className="text-[#8b7d84] text-sm">
                  가입 완료 시 자동으로 <strong className="text-[#ff5c9a]">1,000원 할인 쿠폰</strong>이 발급됩니다.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-[#bbf7d0] text-[#4a3f48] rounded-full flex items-center justify-center font-bold">
                3
              </span>
              <div>
                <p className="text-[#4a3f48] font-medium mb-1">
                  쿠폰 사용하기
                </p>
                <p className="text-[#8b7d84] text-sm">
                  상품 구매 시 쿠폰을 적용하여 할인받으세요!
                </p>
              </div>
            </li>
          </ol>

          <div className="bg-[#d1fae5] rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold text-[#4a3f48] mb-2">
              이벤트 안내
            </h3>
            <ul className="space-y-2 text-sm text-[#8b7d84]">
              <li>• 신규 회원가입 시에만 쿠폰이 발급됩니다.</li>
              <li>• 쿠폰은 가입 완료 후 즉시 발급됩니다.</li>
              <li>• 쿠폰은 마이페이지에서 확인할 수 있습니다.</li>
              <li>• 쿠폰 사용 기한은 발급일로부터 30일입니다.</li>
              <li>• 최소 구매 금액 제한은 없습니다.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/sign-up?redirect_url=/events/signup"
              className="shop-btn-accent inline-flex items-center justify-center gap-2 text-center"
            >
              회원가입 하기
            </Link>
            <Link
              href="/products"
              className="shop-btn-primary inline-flex items-center justify-center gap-2 text-center"
            >
              상품 보러가기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

