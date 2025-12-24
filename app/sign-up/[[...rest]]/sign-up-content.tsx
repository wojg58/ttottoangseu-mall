/**
 * @file app/sign-up/[[...rest]]/sign-up-content.tsx
 * @description 회원가입 폼 컨텐츠 컴포넌트
 */

"use client";

import { SignUp, SignedIn, SignedOut } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function SignUpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectUrl = searchParams.get("redirect_url") || "/";

  console.log("[SignUpContent] 회원가입 폼 렌더링", { redirectUrl });

  // 회원가입 폼 커스터마이징
  useEffect(() => {
    const customizeForm = () => {
      console.group("[SignUpContent] 폼 필드 커스터마이징");

      // 1. lastName 필드를 숨기기
      const lastNameRow = document.querySelector('.cl-formFieldRow__name') as HTMLElement;
      const lastNameField = document.querySelector('.cl-formField__lastName') as HTMLElement;
      if (lastNameField) {
        console.log("성(lastName) 필드 숨김");
        lastNameField.style.display = 'none';
      }

      // firstName 필드의 라벨을 "이름"으로 변경
      const firstNameLabel = document.querySelector('label[for="firstName-field"]') as HTMLLabelElement;
      if (firstNameLabel) {
        console.log("이름 라벨 변경");
        firstNameLabel.textContent = "이름";
      }

      // firstName 필드를 전체 너비로
      const firstNameField = document.querySelector('.cl-formField__firstName') as HTMLElement;
      if (firstNameField && lastNameRow) {
        console.log("이름 필드를 전체 너비로 설정");
        lastNameRow.style.display = 'block';
        firstNameField.style.width = '100%';
      }

      // 2. 필드 순서 변경: 아이디 → 비밀번호 → 이메일
      const usernameRow = document.querySelector('.cl-formFieldRow__username') as HTMLElement;
      const passwordRow = document.querySelector('.cl-formFieldRow__password') as HTMLElement;
      const emailRow = document.querySelector('.cl-formFieldRow__emailAddress') as HTMLElement;
      const form = usernameRow?.parentElement;

      if (form && usernameRow && passwordRow && emailRow) {
        console.log("필드 순서 재정렬: 아이디 → 비밀번호 → 이메일");
        
        // 기존 순서 확인 및 재정렬
        const formChildren = Array.from(form.children);
        const usernameIndex = formChildren.indexOf(usernameRow);
        const passwordIndex = formChildren.indexOf(passwordRow);
        const emailIndex = formChildren.indexOf(emailRow);

        // 순서가 이미 올바르지 않다면 재정렬
        if (!(usernameIndex < passwordIndex && passwordIndex < emailIndex)) {
          // 아이디를 맨 앞으로
          if (lastNameRow && lastNameRow.parentElement) {
            lastNameRow.parentElement.insertBefore(usernameRow, lastNameRow.nextSibling);
          }
          // 비밀번호를 아이디 다음으로
          usernameRow.parentElement?.insertBefore(passwordRow, usernameRow.nextSibling);
          // 이메일을 비밀번호 다음으로
          passwordRow.parentElement?.insertBefore(emailRow, passwordRow.nextSibling);
        }
      }

      // 3. placeholder 텍스트 변경
      const usernameInput = document.querySelector('input[name="username"]') as HTMLInputElement;
      if (usernameInput && !usernameInput.placeholder) {
        console.log("아이디 placeholder 설정");
        usernameInput.placeholder = "아이디를 입력해주세요";
      }

      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
      if (passwordInput && passwordInput.placeholder === "Enter your password") {
        console.log("비밀번호 placeholder 변경");
        passwordInput.placeholder = "비밀번호를 입력하세요";
      }

      console.groupEnd();
    };

    // 초기 실행
    setTimeout(customizeForm, 100);

    // MutationObserver로 동적 변경 감지
    const observer = new MutationObserver(() => {
      customizeForm();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 주기적으로 확인 (Clerk가 동적으로 필드를 추가할 수 있음)
    const interval = setInterval(customizeForm, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

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
                // lastName 필드 숨기기
                formField__lastName: "hidden opacity-0 h-0 w-0",
                formFieldRow__name: "block mb-8",
                formField__firstName: "w-full",
                // 필드 간격 조정
                formFieldRow: "block mb-8 mt-0",
              },
            }}
          />
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm text-[#8b7d84]">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/sign-in"
              className="text-[#ff6b9d] hover:text-[#ff5088] font-medium"
            >
              로그인하기
            </Link>
          </p>
        </div>
      </div>
    </main>
      </SignedOut>
    </>
  );
}

