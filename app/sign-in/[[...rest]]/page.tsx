/**
 * @file app/sign-in/[[...rest]]/page.tsx
 * @description 로그인 페이지 (Catch-all route)
 *
 * 주요 기능:
 * 1. Clerk를 사용한 로그인 폼
 * 2. 아이디와 비밀번호로만 로그인
 */

"use client";

import { Suspense } from "react";
import SignInContent from "./sign-in-content";

export default function SignInPage() {
  console.log("[SignInPage] 로그인 페이지 렌더링");

  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#fff9f7] flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b9d]"></div>
          <p className="mt-4 text-[#8b7d84]">로딩 중...</p>
        </div>
      </main>
    }>
      <SignInContent />
    </Suspense>
  );
}

