/**
 * @file app/sign-up/[[...rest]]/page.tsx
 * @description 회원가입 페이지 (Catch-all route)
 *
 * 주요 기능:
 * 1. Clerk를 사용한 회원가입 폼
 * 2. 회원가입 완료 후 쿠폰 발급 (SyncUserProvider에서 처리)
 */

"use client";

import { Suspense } from "react";
import SignUpContent from "./sign-up-content";

export default function SignUpPage() {
  console.log("[SignUpPage] 회원가입 페이지 렌더링");

  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#fff9f7] flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d]"></div>
          <p className="mt-4 text-[#8b7d84]">로딩 중...</p>
        </div>
      </main>
    }>
      <SignUpContent />
    </Suspense>
  );
}

