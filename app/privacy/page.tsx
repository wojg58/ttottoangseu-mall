/**
 * @file app/privacy/page.tsx
 * @description 개인정보취급방침 페이지
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보취급방침 | 또또앙스",
  description: "또또앙스 개인정보취급방침입니다.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white py-12">
      <div className="shop-container">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-[#4a3f48] mb-8">
            개인정보취급방침
          </h1>

          <div className="prose prose-lg max-w-none text-[#4a3f48] space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제1조 (개인정보의 처리목적)
              </h2>
              <p className="text-lg leading-relaxed mb-4">
                또또앙스(이하 "회사"라 함)는 다음의 목적을 위하여 개인정보를 처리합니다. 
                처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 
                이용 목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>회원 가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지 목적</li>
                <li>재화 또는 서비스 제공: 물품배송, 서비스 제공, 계약서·청구서 발송, 콘텐츠 제공, 맞춤 서비스 제공, 본인인증, 요금결제·정산 목적</li>
                <li>마케팅 및 광고 활용: 신규 서비스(제품) 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 및 참여기회 제공 목적</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제2조 (개인정보의 처리 및 보유기간)
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</li>
                <li>각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>회원 가입 및 관리: 회원 탈퇴 시까지 (단, 관계 법령 위반에 따른 수사·조사 등이 진행중인 경우에는 해당 수사·조사 종료 시까지)</li>
                    <li>재화 또는 서비스 제공: 재화·서비스 공급완료 및 요금결제·정산 완료 시까지 (단, 전자상거래법에 따른 계약 및 청약철회, 대금결제 및 재화 등의 공급에 관한 기록은 5년, 소비자 불만 또는 분쟁처리에 관한 기록은 3년)</li>
                    <li>마케팅 및 광고 활용: 회원 탈퇴 시 또는 동의 철회 시까지</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제3조 (처리하는 개인정보의 항목)
              </h2>
              <p className="text-lg leading-relaxed mb-4">
                회사는 다음의 개인정보 항목을 처리하고 있습니다:
              </p>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">1. 회원 가입 및 관리</h3>
                  <p>필수항목: 이메일, 비밀번호, 이름, 휴대전화번호</p>
                  <p>선택항목: 생년월일, 성별</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. 재화 또는 서비스 제공</h3>
                  <p>필수항목: 이름, 휴대전화번호, 이메일, 주소, 결제정보</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. 인터넷 서비스 이용 과정에서 자동 수집되는 항목</h3>
                  <p>IP주소, 쿠키, MAC주소, 서비스 이용 기록, 방문 기록, 불량 이용 기록 등</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제4조 (개인정보의 제3자 제공)
              </h2>
              <p className="text-lg leading-relaxed">
                회사는 정보주체의 개인정보를 제1조(개인정보의 처리목적)에서 명시한 범위 내에서만 처리하며, 
                정보주체의 동의, 법률의 특별한 규정 등 개인정보 보호법 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제5조 (개인정보처리의 위탁)
              </h2>
              <p className="text-lg leading-relaxed mb-4">
                회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다:
              </p>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">1. 결제 처리</h3>
                  <p>위탁받는 자(수탁자): 결제 대행사</p>
                  <p>위탁하는 업무의 내용: 신용카드 결제, 계좌이체 등 결제 처리</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. 배송 서비스</h3>
                  <p>위탁받는 자(수탁자): 배송업체</p>
                  <p>위탁하는 업무의 내용: 상품 배송</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제6조 (정보주체의 권리·의무 및 그 행사방법)
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>개인정보 처리정지 요구권</li>
                    <li>개인정보 열람요구권</li>
                    <li>개인정보 정정·삭제요구권</li>
                    <li>개인정보 처리정지 요구권</li>
                  </ul>
                </li>
                <li>제1항에 따른 권리 행사는 회사에 대해 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제7조 (개인정보의 파기)
              </h2>
              <p className="text-lg leading-relaxed mb-4">
                회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-lg leading-relaxed">
                <li>파기절차: 이용자가 입력한 정보는 목적 달성 후 별도의 DB에 옮겨져(종이의 경우 별도의 서류) 내부 방침 및 기타 관련 법령에 따라 일정기간 저장된 후 혹은 즉시 파기됩니다.</li>
                <li>파기방법: 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다. 종이에 출력된 개인정보는 분쇄기로 분쇄하거나 소각을 통하여 파기합니다.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제8조 (개인정보 보호책임자)
              </h2>
              <div className="bg-[#ffeef5] rounded-lg p-6 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">개인정보 보호책임자</h3>
                  <p>성명: 우수정</p>
                  <p>직책: 대표</p>
                  <p>연락처: 010-4112-6168, ttottoangseu@naver.com</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#ff6b9d] mb-4">
                제9조 (개인정보 처리방침 변경)
              </h2>
              <p className="text-lg leading-relaxed">
                이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
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

