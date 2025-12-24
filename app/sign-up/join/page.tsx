/**
 * @file app/sign-up/join/page.tsx
 * @description 카페24 스타일 회원가입 페이지
 *
 * 주요 기능:
 * 1. 회원 구분 선택 (개인/사업자/외국인)
 * 2. 기본 정보 입력 (이름, 주소, 연락처 등)
 * 3. 추가 정보 입력 (성별, 생년월일)
 * 4. 약관 동의
 * 5. Clerk + Supabase 통합 회원가입
 *
 * @dependencies
 * - Clerk: 사용자 인증 (이메일, 비밀번호)
 * - Supabase: 추가 정보 저장
 * - react-hook-form: 폼 관리
 * - zod: 유효성 검사
 */

import JoinForm from "@/components/join-form";

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* 페이지 제목 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-center mb-2">회원 가입</h1>
            <p className="text-center text-gray-600">
              또또앙스의 회원이 되어 다양한 혜택을 누리세요
            </p>
          </div>

          {/* 회원가입 폼 */}
          <JoinForm />
        </div>
      </div>
    </main>
  );
}

