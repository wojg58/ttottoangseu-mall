/**
 * @file app/terms/page.tsx
 * @description 이용약관 페이지
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | 또또앙스",
  description: "또또앙스 이용약관입니다.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white py-12">
      <div className="shop-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-[#4a3f48] mb-8">
            이용약관
          </h1>

          <div className="prose prose-lg max-w-none text-[#4a3f48] space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제1조 (목적)
              </h2>
              <p className="text-lg leading-relaxed">
                이 약관은 또또앙스(이하 &quot;회사&quot;라 함)가 운영하는 온라인 쇼핑몰에서 제공하는 서비스의 이용과 관련하여 
                회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제2조 (정의)
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>&quot;몰&quot;이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 또는 용역을 거래할 수 있도록 설정한 가상의 영업장을 말합니다.</li>
                <li>&quot;이용자&quot;란 &quot;몰&quot;에 접속하여 이 약관에 따라 &quot;몰&quot;이 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</li>
                <li>&quot;회원&quot;이라 함은 &quot;몰&quot;에 개인정보를 제공하여 회원등록을 한 자로서, &quot;몰&quot;의 정보를 지속적으로 제공받으며, &quot;몰&quot;이 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</li>
                <li>&quot;비회원&quot;이라 함은 회원에 가입하지 않고 &quot;몰&quot;이 제공하는 서비스를 이용하는 자를 말합니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제3조 (약관의 게시와 개정)
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>회사는 이 약관의 내용과 상호, 영업소 소재지, 대표자의 성명, 사업자등록번호, 연락처 등을 이용자가 쉽게 알 수 있도록 몰의 초기 서비스화면(전면)에 게시합니다.</li>
                <li>회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
                <li>회사가 약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행약관과 함께 몰의 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제4조 (서비스의 제공 및 변경)
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>회사는 다음과 같은 서비스를 제공합니다:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>재화 또는 용역에 대한 정보 제공 및 구매계약의 체결</li>
                    <li>구매계약이 체결된 재화 또는 용역의 배송</li>
                    <li>기타 회사가 정하는 업무</li>
                  </ul>
                </li>
                <li>회사는 재화 또는 용역의 품절 또는 기술적 사양의 변경 등의 경우에는 장차 체결되는 계약에 의해 제공할 재화 또는 용역의 내용을 변경할 수 있습니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제5조 (주문 및 결제)
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>이용자는 몰에서 다음 또는 이와 유사한 방법에 의하여 주문을 할 수 있습니다:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>재화 또는 용역의 선택</li>
                    <li>성명, 주소, 전화번호, 전자우편주소 등의 입력</li>
                    <li>결제방법의 선택</li>
                    <li>주문의 확인</li>
                  </ul>
                </li>
                <li>회사는 이용자의 주문에 대하여 다음 각 호에 해당하지 않는 한 승낙합니다:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>신청 내용에 허위, 기재누락, 오기가 있는 경우</li>
                    <li>미성년자가 담배, 주류 등 청소년보호법에서 금지하는 재화 및 용역을 구매하는 경우</li>
                    <li>기타 구매신청에 승낙하는 것이 회사의 기술상 현저히 지장이 있다고 판단하는 경우</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제6조 (취소 및 환불)
              </h2>
              <p className="text-lg leading-relaxed">
                이용자가 구매한 재화 또는 용역에 대한 취소 및 환불은 관련 법령 및 회사의 환불정책에 따릅니다.
                자세한 내용은 교환/환불 안내 페이지를 참고해주세요.
              </p>
            </section>

            <section>
              <p className="text-sm text-gray-500 mt-8">
                시행일자: 2024년 1월 1일
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

