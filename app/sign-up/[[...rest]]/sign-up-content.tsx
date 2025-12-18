/**
 * @file app/sign-up/[[...rest]]/sign-up-content.tsx
 * @description 회원가입 폼 컨텐츠 컴포넌트
 */

"use client";

import { SignUp, SignedIn, SignedOut } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignUpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectUrl = searchParams.get("redirect_url") || "/events/signup";

  console.log("[SignUpContent] 회원가입 폼 렌더링", { redirectUrl });

  // 이미 로그인된 사용자는 홈으로 리다이렉트
  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-[#fff9f7] flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-lg text-[#4a3f48] mb-4">
              이미 로그인되어 있습니다.
            </p>
            <button
              onClick={() => router.push("/")}
              className="shop-btn-accent"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <main className="min-h-screen bg-[#fff9f7] flex items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#4a3f48] mb-2">
            또또앙스 회원가입
          </h1>
          <p className="text-[#8b7d84]">
            신규가입 시 <strong className="text-[#ff5c9a]">1,000원 할인 쿠폰</strong>을 드립니다!
          </p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            afterSignUpUrl={redirectUrl}
            forceRedirectUrl={redirectUrl}
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-none",
                headerTitle: "text-2xl font-bold text-[#4a3f48]",
                headerSubtitle: "text-[#8b7d84]",
                socialButtonsBlockButton:
                  "border border-[#f5d5e3] hover:bg-[#ffeef5] text-[#4a3f48]",
                formButtonPrimary:
                  "bg-[#ff6b9d] hover:bg-[#ff5088] text-white",
                formFieldLabel: "text-[#4a3f48]",
                formFieldInput:
                  "border-[#f5d5e3] focus:border-[#ff6b9d] focus:ring-[#ff6b9d]",
                footerActionLink: "text-[#ff6b9d] hover:text-[#ff5088]",
                identityPreviewText: "text-[#4a3f48]",
                identityPreviewEditButton: "text-[#ff6b9d]",
              },
            }}
          />
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm text-[#8b7d84]">
            이미 계정이 있으신가요?{" "}
            <a
              href="/sign-in"
              className="text-[#ff6b9d] hover:text-[#ff5088] font-medium"
            >
              로그인하기
            </a>
          </p>
        </div>
      </div>
    </main>
      </SignedOut>
    </>
  );
}

