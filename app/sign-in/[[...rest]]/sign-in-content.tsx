/**
 * @file app/sign-in/[[...rest]]/sign-in-content.tsx
 * @description 로그인 폼 컨텐츠 컴포넌트
 *
 * 주요 기능:
 * 1. 아이디와 비밀번호로 로그인
 * 2. 커스텀 디자인의 로그인 폼
 * 3. 로그인 과정 로깅
 */

"use client";

import { SignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectUrl = searchParams.get("redirect_url") || "/";

  console.group("[SignInContent] 로그인 페이지 초기화");
  console.log("리다이렉트 URL:", redirectUrl);
  console.log("현재 URL:", window.location.href);
  console.groupEnd();

  // placeholder 텍스트 변경, 라벨 추가, 필드 순서 재정렬
  useEffect(() => {
    const updateForm = () => {
      console.group("[SignInContent] 폼 필드 업데이트");

      // "최근 사용" 배지 숨기기
      const badges = document.querySelectorAll('.cl-lastAuthenticationStrategyBadge');
      badges.forEach((badge) => {
        const badgeElement = badge as HTMLElement;
        if (badgeElement.style.display !== 'none') {
          console.log("'최근 사용' 배지 숨김");
          badgeElement.style.display = 'none';
        }
      });

      // 아이디 필드 라벨 변경
      const identifierLabel = document.querySelector(
        'label[for="identifier-field"]'
      ) as HTMLLabelElement;
      if (identifierLabel && !identifierLabel.textContent?.includes("아이디")) {
        console.log("아이디 라벨 변경");
        identifierLabel.textContent = "아이디";
      }

      // 아이디 필드 placeholder 변경
      const identifierInput = document.querySelector(
        'input[name="identifier"], input[id="identifier-field"]'
      ) as HTMLInputElement;
      if (identifierInput && identifierInput.placeholder !== "아이디를 입력하세요") {
        console.log("아이디 placeholder 변경");
        identifierInput.placeholder = "아이디를 입력하세요";
      }

      // 비밀번호 필드 라벨 변경
      const passwordLabel = document.querySelector(
        'label[for="password-field"]'
      ) as HTMLLabelElement;
      if (passwordLabel && !passwordLabel.textContent?.includes("비밀번호")) {
        console.log("비밀번호 라벨 변경");
        passwordLabel.textContent = "비밀번호";
      }

      // 비밀번호 필드 placeholder 변경
      const passwordInput = document.querySelector(
        'input[name="password"], input[id="password-field"]'
      ) as HTMLInputElement;
      if (passwordInput && passwordInput.placeholder !== "비밀번호를 입력하세요") {
        console.log("비밀번호 placeholder 변경");
        passwordInput.placeholder = "비밀번호를 입력하세요";
      }

      // ===== 핵심: 필드 구조 재정렬 =====
      // 각 필드의 라벨 행과 입력창을 올바른 순서로 재배치
      const identifierLabelRow = document.querySelector('.cl-formFieldLabelRow__identifier') as HTMLElement;
      const identifierInputContainer = identifierInput?.parentElement as HTMLElement;
      const passwordLabelRow = document.querySelector('.cl-formFieldLabelRow__password') as HTMLElement;
      const passwordInputContainer = passwordInput?.closest('.cl-formFieldInputGroup') as HTMLElement || passwordInput?.parentElement as HTMLElement;

      const identifierRow = document.querySelector('.cl-formFieldRow__identifier') as HTMLElement;
      const passwordRow = document.querySelector('.cl-formFieldRow__password') as HTMLElement;

      // 아이디 필드 재정렬: 라벨 → 입력창
      if (identifierRow && identifierLabelRow && identifierInputContainer) {
        console.log("아이디 필드 순서 재정렬");
        identifierRow.innerHTML = '';
        identifierRow.appendChild(identifierLabelRow);
        identifierRow.appendChild(identifierInputContainer);
        
        identifierRow.style.cssText = `
          margin-bottom: 2rem !important;
          margin-top: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 0.5rem !important;
        `;
      }

      // 비밀번호 필드 재정렬: 라벨 → 입력창
      if (passwordRow && passwordLabelRow && passwordInputContainer) {
        console.log("비밀번호 필드 순서 재정렬");
        passwordRow.innerHTML = '';
        passwordRow.appendChild(passwordLabelRow);
        passwordRow.appendChild(passwordInputContainer);
        
        passwordRow.style.cssText = `
          margin-top: 0 !important;
          margin-bottom: 2rem !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 0.5rem !important;
        `;
      }

      // 필드 순서: 아이디 → 비밀번호
      if (identifierRow && passwordRow) {
        const form = identifierRow.parentElement;
        if (form) {
          const formChildren = Array.from(form.children);
          const identifierIndex = formChildren.indexOf(identifierRow);
          const passwordIndex = formChildren.indexOf(passwordRow);

          if (identifierIndex > passwordIndex) {
            console.log("아이디 필드를 비밀번호 필드 앞으로 이동");
            form.insertBefore(identifierRow, passwordRow);
          }
        }
      }

      console.groupEnd();
    };

    // 초기 실행
    setTimeout(updateForm, 100);

    // MutationObserver로 동적으로 추가되는 요소 감지
    const observer = new MutationObserver(() => {
      updateForm();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 주기적으로 확인 (Clerk가 동적으로 필드를 추가할 수 있음)
    const interval = setInterval(updateForm, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  // 로그인 성공/실패 감지
  useEffect(() => {
    const handleSignIn = () => {
      console.group("[SignInContent] 로그인 시도 감지");
      console.log("시간:", new Date().toISOString());
      console.groupEnd();
    };

    // 폼 제출 이벤트 리스너
    const form = document.querySelector('form');
    if (form) {
      form.addEventListener('submit', handleSignIn);
      return () => form.removeEventListener('submit', handleSignIn);
    }
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
              onClick={() => {
                console.log("[SignInContent] 홈으로 이동");
                router.push("/");
              }}
              className="shop-btn-accent"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <main className="min-h-screen bg-gradient-to-br from-[#fff9f7] to-[#ffe8f0] flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md">
            {/* 헤더 */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-[#ff6b9d] mb-3 tracking-tight">
                또또앙스
              </h1>
              <p className="text-[#8b7d84] text-base">
                아이디와 비밀번호를 입력해주세요
              </p>
            </div>

            {/* 로그인 폼 카드 */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-[#f5d5e3]">
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                afterSignInUrl={redirectUrl}
                forceRedirectUrl={redirectUrl}
                appearance={{
                  elements: {
                    rootBox: "mx-auto",
                    card: "shadow-none bg-transparent",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "hidden",
                    dividerRow: "hidden",
                    
                    // 폼 컨테이너
                    form: "flex flex-col gap-8",
                    
                    // 폼 필드 행 - 간격 확보
                    formFieldRow: "block mb-8 mt-0",
                    
                    // 폼 필드 라벨 행
                    formFieldLabelRow: "flex justify-between items-center mb-3 mt-0",
                    
                    // 폼 필드 라벨
                    formFieldLabel: "block text-[#4a3f48] font-semibold text-base",
                    
                    // 입력 필드
                    formFieldInput: 
                      "block w-full px-4 py-3 mt-2 mb-0 rounded-xl border-2 border-[#f5d5e3] " +
                      "focus:border-[#ff6b9d] focus:ring-2 focus:ring-[#ff6b9d]/20 " +
                      "transition-all duration-200 text-[#4a3f48] placeholder:text-[#d4b5c8] " +
                      "box-border",
                    
                    // 로그인 버튼
                    formButtonPrimary:
                      "w-full bg-gradient-to-r from-[#ff6b9d] to-[#ff5088] " +
                      "hover:from-[#ff5088] hover:to-[#ff3d77] " +
                      "text-white font-semibold py-3 rounded-xl mt-8 " +
                      "transition-all duration-200 shadow-md hover:shadow-lg " +
                      "transform hover:-translate-y-0.5",
                    
                    // 푸터 링크
                    footerActionLink: "text-[#ff6b9d] hover:text-[#ff5088] font-medium",
                    
                    // 기타 요소
                    identityPreviewText: "text-[#4a3f48]",
                    identityPreviewEditButton: "text-[#ff6b9d] hover:text-[#ff5088]",
                    
                    // 오류 메시지
                    formFieldErrorText: "text-red-500 text-sm mt-2",
                    
                    // 최근 사용 배지 숨기기
                    lastAuthenticationStrategyBadge: "hidden opacity-0 h-0 w-0",
                    
                    // 비밀번호 필드 액션
                    formFieldAction: "mt-2",
                  },
                }}
              />
            </div>

            {/* 회원가입 링크 */}
            <div className="mt-6 text-center">
              <p className="text-sm text-[#8b7d84]">
                계정이 없으신가요?{" "}
                <a
                  href="/sign-up"
                  className="text-[#ff6b9d] hover:text-[#ff5088] font-semibold transition-colors"
                  onClick={() => {
                    console.log("[SignInContent] 회원가입 페이지로 이동");
                  }}
                >
                  회원가입하기
                </a>
              </p>
            </div>
          </div>
        </main>
      </SignedOut>
    </>
  );
}

