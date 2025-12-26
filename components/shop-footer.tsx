/**
 * @file components/shop-footer.tsx
 * @description 또또앙스 쇼핑몰 푸터 컴포넌트
 */

import Link from "next/link";
import Image from "next/image";

export default function ShopFooter() {
  return (
    <footer className="bg-white text-[#4a3f48] mt-0 border-t border-gray-200">
      {/* 푸터 상단 링크 */}
      <div className="border-b border-gray-200">
        <div className="shop-container py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ul className="flex flex-wrap items-center gap-[1.2cm] text-sm text-[#4a3f48]">
              <li>
                <Link href="/company" className="hover:text-[#ff6b9d] transition-colors">
                  회사소개
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#ff6b9d] transition-colors">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#ff6b9d] transition-colors">
                  개인정보취급방침
                </Link>
              </li>
              <li>
                <Link href="/guide" className="hover:text-[#ff6b9d] transition-colors">
                  이용안내
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

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
                sizes="100px"
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
                사업자 등록번호 561-14-02359{" "}
                {"\u00A0".repeat(3)}
                통신판매업 신고번호 제 2023-경기안성-0595 호
              </p>
              <p>
                사업장 주소 경기도 안성시 공도읍 공도로 51-17, 104동 1502호(공도우미린더퍼스트)
              </p>
            </div>
          </div>

          {/* 고객 센터 */}
          <div className="h-[200px] flex flex-col">
            <h4 className="font-bold mb-4 text-black">고객 센터</h4>
            <div className="space-y-2 text-sm text-[#4a3f48]">
              <div>010-4112-6168</div>
              <div>ttottoangseu@naver.com</div>
              <div>오전 9시 ~ 오후 6시(주말/공휴일 휴무)</div>
            </div>
          </div>

          {/* 은행 정보 */}
          <div className="h-[200px] flex flex-col">
            <h4 className="font-bold mb-4 text-black">계좌 정보</h4>
            <div className="space-y-2 text-sm text-[#4a3f48]">
              <p>카카오뱅크 3333-28-2841708</p>
              <p>예금주 : 우수정</p>
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
