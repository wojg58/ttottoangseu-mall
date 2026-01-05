/**
 * @file app/guide/page.tsx
 * @description 이용안내 페이지
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용안내 | 또또앙스",
  description: "또또앙스 이용안내 페이지입니다.",
};

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-white py-12">
      <div className="shop-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-[#4a3f48] mb-8">
            이용안내
          </h1>

          <div className="prose prose-lg max-w-none text-[#4a3f48] space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                주문 방법
              </h2>
              <ol className="list-decimal list-inside space-y-3 text-lg leading-relaxed">
                <li>원하시는 상품을 선택하여 장바구니에 담아주세요.</li>
                <li>
                  장바구니에서 주문할 상품을 확인하고 수량을 조정할 수 있습니다.
                </li>
                <li>주문하기 버튼을 클릭하여 주문서를 작성해주세요.</li>
                <li>배송지 정보와 결제 방법을 선택해주세요.</li>
                <li>주문 내용을 최종 확인한 후 결제를 진행해주세요.</li>
                <li>결제가 완료되면 주문 확인 메일이 발송됩니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                배송 안내
              </h2>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">배송 기간</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>입금 확인 후 1~3일 이내 발송됩니다.</li>
                    <li>
                      배송은 평일 기준으로 진행되며, 주말 및 공휴일은 배송이
                      지연될 수 있습니다.
                    </li>
                    <li>
                      도서산간 지역의 경우 추가 배송비가 발생할 수 있습니다.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">배송비</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>기본 배송비: 3,000원</li>
                    <li>70,000원 이상 구매시 무료배송</li>
                    <li>
                      제주도 및 도서산간 지역: 추가 배송비 발생 (상품별 상이)
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">배송 추적</h3>
                  <p>주문 완료 후 주문 내역에서 배송 추적이 가능합니다.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                결제 방법
              </h2>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">신용카드</h3>
                  <p>국내외 발행 모든 신용카드 사용 가능합니다.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">계좌이체</h3>
                  <p>실시간 계좌이체를 통해 결제하실 수 있습니다.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">무통장 입금</h3>
                  <p>
                    가상계좌를 통한 무통장 입금이 가능합니다. 입금 확인 후
                    배송이 진행됩니다.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">간편결제</h3>
                  <p>
                    카카오페이, 네이버페이 등 간편결제 서비스를 이용하실 수
                    있습니다.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                교환 및 환불
              </h2>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">교환/환불 기간</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      환불 및 교환은 수령하신 날을 포함하여 7일 내에 요청을
                      해주셔야만 가능합니다
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">교환/환불 불가 사유</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      고객의 단순 변심으로 인한 경우 (단, 상품의 내용이
                      표시·광고 내용과 다른 경우는 제외)
                    </li>
                    <li>
                      상품 및 포장을 훼손하여 상품의 가치가 현저히 감소한 경우
                    </li>
                    <li>
                      시간이 지나 다시 판매하기 곤란할 정도로 상품의 가치가
                      현저히 감소한 경우
                    </li>
                    <li>복제가 가능한 상품의 포장을 훼손한 경우</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">반품 배송비</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>고객의 단순 변심: 고객 부담 (왕복 배송비 7,000원)</li>
                    <li>상품의 하자 또는 오배송: 회사 부담</li>
                    <li>
                      교환 및 환불, 반품 접수 시 지정 택배사인 CJ대한통운을 통해
                      수거가 진행됩니다.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                회원 혜택
              </h2>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">적립금</h3>
                  <p>구매 금액의 일정 비율이 적립금으로 적립됩니다.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">쿠폰</h3>
                  <p>신규 가입 시 및 특정 이벤트 시 쿠폰을 제공합니다.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">무료배송</h3>
                  <p>
                    일정 금액 이상 구매 시 무료배송 혜택을 받으실 수 있습니다.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                고객센터
              </h2>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">연락처</h3>
                  <p>전화: 010-4112-6168</p>
                  <p>이메일: ttottoangseu@naver.com</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">운영 시간</h3>
                  <p>평일 09:00 ~ 18:00 (주말 및 공휴일 휴무)</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">문의 방법</h3>
                  <p>상담챗봇, 1:1 문의 게시판을 통해 문의해주세요.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
