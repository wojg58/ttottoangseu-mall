/**
 * @file app/sign-in/[[...rest]]/sign-in-content.tsx
 * @description 로그인 폼 컨텐츠 컴포넌트
 *
 * 주요 기능:
 * 1. 이메일과 비밀번호로 로그인
 * 2. 2열 레이아웃의 커스텀 디자인 로그인 폼 (라벨 왼쪽, 입력 필드 오른쪽)
 * 3. 로그인 과정 로깅
 */

"use client";

import { SignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectUrl = searchParams.get("redirect_url") || "/";

  // 클라이언트 사이드에서만 실행
  if (typeof window !== "undefined") {
    console.group("[SignInContent] 로그인 페이지 초기화");
    console.log("리다이렉트 URL:", redirectUrl);
    console.log("현재 URL:", window.location.href);
    console.groupEnd();
  }

  // 폼 필드를 세로 레이아웃으로 변경 (라벨 위, 입력칸 아래)
  useEffect(() => {
    // 이미 적용되었는지 추적하는 플래그
    let isEmailFieldApplied = false;
    let isPasswordFieldApplied = false;
    let updateCount = 0;
    const MAX_UPDATES = 10; // 최대 업데이트 횟수 제한

    const updateForm = () => {
      // 무한 루프 방지: 최대 업데이트 횟수 제한
      if (updateCount >= MAX_UPDATES) {
        console.log("[SignInContent] 최대 업데이트 횟수 도달, 업데이트 중지");
        return;
      }
      updateCount++;

      // 이미 적용된 필드는 건너뛰기
      if (isEmailFieldApplied && isPasswordFieldApplied) {
        return;
      }

      console.group("[SignInContent] 폼 필드 업데이트 - 세로 레이아웃");

      // "최근 사용" 배지 숨기기
      const badges = document.querySelectorAll('.cl-lastAuthenticationStrategyBadge');
      badges.forEach((badge) => {
        const badgeElement = badge as HTMLElement;
        if (badgeElement.style.display !== 'none') {
          badgeElement.style.display = 'none';
        }
      });

      // 아이디 필드 처리
      const identifierRow = document.querySelector('.cl-formFieldRow__identifier') as HTMLElement;
      const identifierInput = document.querySelector(
        'input[name="identifier"], input[id="identifier-field"], input[id*="identifier"]'
      ) as HTMLInputElement;
      const identifierLabelRow = identifierRow?.querySelector('.cl-formFieldLabelRow__identifier') as HTMLElement;
      const identifierLabel = identifierRow?.querySelector('.cl-formFieldLabel__identifier-field') as HTMLElement;

      if (identifierRow && identifierInput && !isEmailFieldApplied) {
        console.log("아이디 필드 스타일 적용");
        
        // placeholder 비우기
        identifierInput.placeholder = "";

        // 라벨 행과 라벨이 보이도록 보장
        if (identifierLabelRow) {
          identifierLabelRow.style.cssText = `
            display: block !important;
            margin-bottom: 0.5rem !important;
            visibility: visible !important;
            opacity: 1 !important;
          `;
        }
        if (identifierLabel) {
          identifierLabel.style.cssText = `
            display: block !important;
            margin-bottom: 0.5rem !important;
            visibility: visible !important;
            opacity: 1 !important;
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            color: #4a3f48 !important;
          `;
        }

        isEmailFieldApplied = true;
      }

      // 비밀번호 필드 처리
      const passwordRow = document.querySelector('.cl-formFieldRow__password') as HTMLElement;
      const passwordInput = document.querySelector(
        'input[name="password"], input[id="password-field"], input[id*="password"]'
      ) as HTMLInputElement;
      const passwordLabelRow = passwordRow?.querySelector('.cl-formFieldLabelRow__password') as HTMLElement;
      const passwordLabel = passwordRow?.querySelector('.cl-formFieldLabel__password-field') as HTMLElement;

      if (passwordRow && passwordInput && !isPasswordFieldApplied) {
        console.log("비밀번호 필드 스타일 적용 - 1cm 간격");
        
        // placeholder 비우기
        passwordInput.placeholder = "";

        // 비밀번호 필드 행의 하단 간격을 1cm로 설정 (px 단위 fallback 포함)
        passwordRow.style.cssText = `
          position: relative !important;
          display: block !important;
          margin-top: 0 !important;
          margin-bottom: 37.8px !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          clear: both !important;
          width: 100% !important;
          box-sizing: border-box !important;
        `;

        // 라벨 행과 라벨이 보이도록 보장
        if (passwordLabelRow) {
          passwordLabelRow.style.cssText = `
            display: block !important;
            margin-bottom: 0.5rem !important;
            visibility: visible !important;
            opacity: 1 !important;
          `;
        }
        if (passwordLabel) {
          passwordLabel.style.cssText = `
            display: block !important;
            margin-bottom: 0.5rem !important;
            visibility: visible !important;
            opacity: 1 !important;
            font-size: 0.875rem !important;
            font-weight: 500 !important;
            color: #4a3f48 !important;
          `;
        }

        isPasswordFieldApplied = true;
      }

      // 필드 순서: 이메일 → 비밀번호
      if (identifierRow && passwordRow && isEmailFieldApplied && isPasswordFieldApplied) {
        const form = identifierRow.parentElement;
        if (form) {
          const formChildren = Array.from(form.children);
          const identifierIndex = formChildren.indexOf(identifierRow);
          const passwordIndex = formChildren.indexOf(passwordRow);

          if (identifierIndex > passwordIndex) {
            form.insertBefore(identifierRow, passwordRow);
          }
        }
      }

      // 오류 메시지 위치 조정 (입력칸 아래)
      if (identifierRow) {
        const identifierError = identifierRow.querySelector('.cl-formFieldErrorText') as HTMLElement;
        if (identifierError) {
          identifierError.style.cssText = `
            margin-top: 0.5rem !important;
            margin-left: 0 !important;
            color: #ef4444 !important;
            font-size: 0.875rem !important;
          `;
        }
      }

      if (passwordRow) {
        const passwordError = passwordRow.querySelector('.cl-formFieldErrorText') as HTMLElement;
        if (passwordError) {
          passwordError.style.cssText = `
            margin-top: 0.5rem !important;
            margin-left: 0 !important;
            color: #ef4444 !important;
            font-size: 0.875rem !important;
          `;
        }
      }

      // 로그인 버튼이 보이도록 보장 및 간격 확인
      const loginButton = document.querySelector('.cl-formButtonPrimary, button[type="submit"]') as HTMLElement;
      const loginButtonContainer = loginButton?.closest('.cl-internal-1pnppin') as HTMLElement;
      
      if (loginButton) {
        console.log("로그인 버튼 스타일 적용");
        loginButton.style.cssText = `
          position: relative !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
          z-index: 1 !important;
        `;
      } else {
        console.log("로그인 버튼을 찾을 수 없음");
      }

      // 로그인 버튼 컨테이너에도 간격 설정 (1cm = 37.8px)
      if (loginButtonContainer) {
        console.log("로그인 버튼 컨테이너 간격 설정 - 1cm");
        loginButtonContainer.style.cssText = `
          margin-top: 37.8px !important;
        `;
      }

      console.groupEnd();
    };

    // 초기 실행 (지연 시간을 늘려 Clerk가 완전히 렌더링된 후 실행)
    const initialTimeout = setTimeout(updateForm, 500);

    // MutationObserver는 더 구체적으로 타겟팅하고, throttle 적용
    let lastUpdateTime = 0;
    const THROTTLE_MS = 2000; // 2초마다 최대 1회만 업데이트

    const observer = new MutationObserver(() => {
      const now = Date.now();
      if (now - lastUpdateTime > THROTTLE_MS && (!isEmailFieldApplied || !isPasswordFieldApplied)) {
        lastUpdateTime = now;
        updateForm();
      }
    });

    // Clerk 폼이 렌더링될 컨테이너만 관찰
    const formContainer = document.querySelector('.cl-rootBox, .cl-card, form');
    if (formContainer) {
      observer.observe(formContainer, {
        childList: true,
        subtree: true,
        attributes: false, // 속성 변경은 무시
      });
    }

    // 주기적 확인은 제거 (MutationObserver로 충분)

    return () => {
      clearTimeout(initialTimeout);
      observer.disconnect();
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
        <main className="min-h-screen bg-white flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-2xl">
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
            <div className="bg-white rounded-lg p-8 md:p-12 shadow-sm border border-gray-200 min-h-[500px]">
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
                    form: "flex flex-col gap-0",
                    
                    // 폼 필드 행 - 겹치지 않도록 명확한 간격 설정
                    formFieldRow: "block mb-6 mt-0 relative w-full",
                    
                    // 폼 필드 라벨 행 - 표시
                    formFieldLabelRow: "block mb-2",
                    
                    // 폼 필드 라벨 - 표시
                    formFieldLabel: "block text-sm font-medium text-[#4a3f48] mb-2",
                    
                    // 입력 필드
                    formFieldInput: 
                      "block w-full px-4 py-4 rounded-lg border border-gray-300 " +
                      "focus:border-[#ff6b9d] focus:ring-2 focus:ring-[#ff6b9d]/20 " +
                      "transition-all duration-200 text-[#4a3f48] placeholder:text-transparent " +
                      "box-border min-h-[3.5rem] text-base",
                    
                    // 로그인 버튼
                    formButtonPrimary:
                      "w-full bg-[#ff6b9d] hover:bg-[#ff5088] " +
                      "text-white font-semibold py-3 rounded-lg " +
                      "transition-all duration-200 shadow-sm hover:shadow-md",
                    
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
                <Link
                  href="/sign-up"
                  className="text-[#ff6b9d] hover:text-[#ff5088] font-semibold transition-colors"
                  onClick={() => {
                    console.log("[SignInContent] 회원가입 페이지로 이동");
                  }}
                >
                  회원가입하기
                </Link>
              </p>
            </div>
          </div>
        </main>
      </SignedOut>
    </>
  );
}

