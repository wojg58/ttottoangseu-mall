/**
 * @file components/shop-footer.tsx
 * @description 또또앙스 쇼핑몰 푸터 컴포넌트
 */

import Link from "next/link";
import Image from "next/image";

export default function ShopFooter() {
  return (
    <footer className="bg-white text-[#4a3f48] mt-0 border-t border-gray-200">
      <div className="shop-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* 브랜드 정보 */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/character.png"
                alt="또또앙스"
                width={100}
                height={100}
                className="object-contain"
              />
              <div>
                <h3 className="text-[45px] font-bold brand-text-logo text-[#4a3f48]">또또앙스</h3>
              </div>
            </div>
            <div className="text-[#4a3f48] text-sm leading-relaxed whitespace-pre-line">
              <p className="mb-2">
                상호명 또또앙스{" "}
                {"\u00A0".repeat(25)}
                대표자명 우수정
              </p>
              <p className="mb-2">
                대표전화 010-4112-6168{" "}
                {"\u00A0".repeat(12)}
                이메일 ttottoangseu@naver.com
              </p>
              <p className="mb-2">
                사업자 등록번호 561-14-02359{" "}
                {"\u00A0".repeat(3)}
                통신판매업 신고번호 제 2023-경기안성-0595 호
              </p>
              <p>
                사업장 주소 경기도 안성시 공도읍 공도로 51-17, 104동 1502호(공도우미린더퍼스트)
              </p>
            </div>
          </div>

          {/* 고객 서비스 */}
          <div>
            <h4 className="font-bold mb-4 text-black">고객 서비스</h4>
            <ul className="space-y-2 text-sm text-[#4a3f48]">
              <li>
                <Link href="/faq" className="hover:text-[#fad2e6]">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-[#fad2e6]">
                  배송 안내
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-[#fad2e6]">
                  교환/환불 안내
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#fad2e6]">
                  문의하기
                </Link>
              </li>
            </ul>
          </div>

          {/* 쇼핑 정보 */}
          <div>
            <h4 className="font-bold mb-4 text-black">쇼핑 정보</h4>
            <ul className="space-y-2 text-sm text-[#4a3f48]">
              <li>
                <Link href="/products" className="hover:text-[#fad2e6]">
                  전체 상품
                </Link>
              </li>
              <li>
                <Link
                  href="/products?featured=true"
                  className="hover:text-[#fad2e6]"
                >
                  베스트 상품
                </Link>
              </li>
              <li>
                <Link
                  href="/products?new=true"
                  className="hover:text-[#fad2e6]"
                >
                  신상품
                </Link>
              </li>
              <li>
                <Link
                  href="/products?sale=true"
                  className="hover:text-[#fad2e6]"
                >
                  할인 상품
                </Link>
              </li>
            </ul>
          </div>

          {/* 이용약관 및 개인정보처리방침 */}
          <div className="flex flex-col justify-end">
            <div className="flex flex-col gap-2 text-xs text-[#4a3f48]">
              <Link href="/terms" className="hover:text-[#ff6b9d]">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-[#ff6b9d]">
                개인정보처리방침
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 저작권 섹션 (검정색 배경) */}
      <div className="bg-black text-white py-4">
        <div className="shop-container">
          <p className="text-center text-[15px] text-white whitespace-nowrap">
            © 2024 또또앙스. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
