/**
 * @file app/company/page.tsx
 * @description 회사소개 페이지
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회사소개 | 또또앙스",
  description: "또또앙스 회사 소개 페이지입니다.",
};

export default function CompanyPage() {
  return (
    <main className="min-h-screen bg-white py-12">
      <div className="shop-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-[#4a3f48] mb-8">
            회사소개
          </h1>

          <div className="prose prose-lg max-w-none text-[#4a3f48]">
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                또또앙스에 오신 것을 환영합니다
              </h2>
              <p className="text-lg leading-relaxed mb-4">
                또또앙스는 귀여운 정품 캐릭터 키덜트 소품을 판매하는 전문 쇼핑몰입니다.
                산리오, 짱구, 유키오 등 다양한 캐릭터 굿즈를 통해 고객들에게 두근거리는 설렘을 선사합니다.
              </p>
              <p className="text-lg leading-relaxed">
                우리는 고품질의 정품 상품만을 판매하며, 고객 만족을 최우선으로 생각합니다.
                인형 키링, 파우치, 완구, 스티커 등 다양한 아이템을 제공하고 있습니다.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                회사 정보
              </h2>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-3">
                <div className="flex">
                  <span className="font-semibold w-[150px]">상호명</span>
                  <span>또또앙스</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-[150px]">대표자명</span>
                  <span>우수정</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-[150px]">대표전화</span>
                  <span>010-4112-6168</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-[150px]">이메일</span>
                  <span>ttottoangseu@naver.com</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-[150px]">사업자 등록번호</span>
                  <span>561-14-02359</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-[150px]">통신판매업 신고번호</span>
                  <span>제 2023-경기안성-0595 호</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-[150px]">사업장 주소</span>
                  <span>경기도 안성시 공도읍 공도로 51-17, 104동 1502호(공도우미린더퍼스트)</span>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                비전
              </h2>
              <p className="text-lg leading-relaxed">
                또또앙스는 고객들에게 최고의 쇼핑 경험을 제공하고, 
                캐릭터 굿즈를 통해 일상에 작은 행복을 전달하는 것을 목표로 합니다.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

