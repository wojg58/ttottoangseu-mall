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

  console.group("[SignInContent] 로그인 페이지 초기화");
  console.log("리다이렉트 URL:", redirectUrl);
  console.log("현재 URL:", window.location.href);
  console.groupEnd();

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

      // 이메일 필드 처리
      const identifierRow = document.querySelector('.cl-formFieldRow__identifier') as HTMLElement;
      const identifierInput = document.querySelector(
        'input[name="identifier"], input[id="identifier-field"], input[id*="identifier"]'
      ) as HTMLInputElement;
      const identifierLabel = document.querySelector(
        'label[for="identifier-field"], label[for*="identifier"]'
      ) as HTMLLabelElement;

      if (identifierRow && identifierInput && identifierLabel && !isEmailFieldApplied) {
        console.log("아이디 필드 DOM 재배치");
        
        // 라벨 변경
        const labelText = identifierLabel.textContent || '';
        if (!labelText.includes("아이디")) {
          const asterisk = document.createElement('span');
          asterisk.textContent = '* ';
          asterisk.style.color = '#ef4444';
          asterisk.style.marginRight = '4px';
          
          const labelSpan = document.createElement('span');
          labelSpan.textContent = '아이디';
          
          identifierLabel.innerHTML = '';
          identifierLabel.appendChild(asterisk);
          identifierLabel.appendChild(labelSpan);
        }

        // placeholder 변경
        if (identifierInput.placeholder !== "example@email.com") {
          identifierInput.placeholder = "example@email.com";
        }

        // 라벨 행과 입력 컨테이너 찾기
        const identifierLabelRow = identifierRow.querySelector('.cl-formFieldLabelRow__identifier') as HTMLElement;
        const identifierInputWrapper = identifierInput.closest('.cl-internal-17uj465') as HTMLElement || 
                                       identifierInput.parentElement?.parentElement as HTMLElement;
        
        if (identifierLabelRow && identifierInputWrapper) {
          // identifierRow의 스타일 설정
          identifierRow.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            margin-bottom: 1.5rem !important;
          `;
          
          // 라벨 행의 스타일 (맨 위에)
          identifierLabelRow.style.cssText = `
            margin-bottom: 0.75rem !important;
            display: block !important;
          `;
          
          // 입력 컨테이너의 스타일
          identifierInputWrapper.style.cssText = `
            display: block !important;
            margin: 0 !important;
          `;
          
          // 입력 필드 스타일
          identifierInput.style.cssText = `
            width: 100% !important;
            padding: 1rem !important;
            min-height: 3.5rem !important;
            border: 1px solid #d1d5db !important;
            border-radius: 0.5rem !important;
            font-size: 1rem !important;
            box-sizing: border-box !important;
          `;
          
          // ** 핵심: 라벨 행을 identifierRow의 맨 앞에 직접 이동 **
          identifierRow.insertBefore(identifierLabelRow, identifierRow.firstChild);
          
          // 안내 문구 추가 (입력칸 아래)
          if (!identifierRow.querySelector('.email-hint')) {
            const hintContainer = document.createElement('p');
            hintContainer.className = 'email-hint';
            hintContainer.textContent = '로그인 아이디로 사용할 이메일을 입력해 주세요.';
            hintContainer.style.cssText = `
              font-size: 0.875rem !important;
              color: #6b7280 !important;
              margin-top: 0.5rem !important;
              margin-bottom: 0 !important;
            `;
            identifierRow.appendChild(hintContainer);
          }

          isEmailFieldApplied = true;
        }
      }

      // 비밀번호 필드 처리
      const passwordRow = document.querySelector('.cl-formFieldRow__password') as HTMLElement;
      const passwordInput = document.querySelector(
        'input[name="password"], input[id="password-field"], input[id*="password"]'
      ) as HTMLInputElement;
      const passwordLabel = document.querySelector(
        'label[for="password-field"], label[for*="password"]'
      ) as HTMLLabelElement;

      if (passwordRow && passwordInput && passwordLabel && !isPasswordFieldApplied) {
        console.log("비밀번호 필드 DOM 재배치");
        
        // 라벨 변경
        const labelText = passwordLabel.textContent || '';
        if (!labelText.includes("비밀번호")) {
          const asterisk = document.createElement('span');
          asterisk.textContent = '* ';
          asterisk.style.color = '#ef4444';
          asterisk.style.marginRight = '4px';
          
          const labelSpan = document.createElement('span');
          labelSpan.textContent = '비밀번호';
          
          passwordLabel.innerHTML = '';
          passwordLabel.appendChild(asterisk);
          passwordLabel.appendChild(labelSpan);
        }

        // placeholder 변경
        if (passwordInput.placeholder !== "비밀번호를 입력해주세요") {
          passwordInput.placeholder = "비밀번호를 입력해주세요";
        }

        // 라벨 행과 입력 컨테이너 찾기
        const passwordLabelRow = passwordRow.querySelector('.cl-formFieldLabelRow__password') as HTMLElement;
        const passwordInputWrapper = passwordInput.closest('.cl-formFieldInputGroup') as HTMLElement || 
                                    passwordInput.parentElement as HTMLElement;
        
        if (passwordLabelRow && passwordInputWrapper) {
          // passwordRow의 스타일 설정
          passwordRow.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            margin-bottom: 1.5rem !important;
          `;
          
          // 라벨 행의 스타일 (맨 위에)
          passwordLabelRow.style.cssText = `
            margin-bottom: 0.75rem !important;
            display: block !important;
          `;
          
          // 입력 컨테이너의 스타일
          passwordInputWrapper.style.cssText = `
            display: block !important;
            margin: 0 !important;
          `;
          
          // 입력 필드 스타일
          passwordInput.style.cssText = `
            width: 100% !important;
            padding: 1rem !important;
            min-height: 3.5rem !important;
            border: 1px solid #d1d5db !important;
            border-radius: 0.5rem !important;
            font-size: 1rem !important;
            box-sizing: border-box !important;
          `;
          
          // ** 핵심: 라벨 행을 passwordRow의 맨 앞에 직접 이동 **
          passwordRow.insertBefore(passwordLabelRow, passwordRow.firstChild);
          
          // 안내 문구 추가 (입력칸 아래)
          if (!passwordRow.querySelector('.password-hint')) {
            const hintContainer = document.createElement('p');
            hintContainer.className = 'password-hint';
            hintContainer.textContent = '영문/숫자/특수문자 중 2가지 이상 조합, 8자~16자';
            hintContainer.style.cssText = `
              font-size: 0.875rem !important;
              color: #6b7280 !important;
              margin-top: 0.5rem !important;
              margin-bottom: 0 !important;
            `;
            passwordRow.appendChild(hintContainer);
          }

          isPasswordFieldApplied = true;
        }
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
                    form: "flex flex-col gap-4",
                    
                    // 폼 필드 행 (간격 증가)
                    formFieldRow: "block mb-4 mt-0",
                    
                    // 폼 필드 라벨 행
                    formFieldLabelRow: "flex justify-start items-center mb-0 mt-0",
                    
                    // 폼 필드 라벨
                    formFieldLabel: "block text-[#4a3f48] font-medium text-base",
                    
                    // 입력 필드 (높이 증가)
                    formFieldInput: 
                      "block w-full px-4 py-4 rounded-lg border border-gray-300 " +
                      "focus:border-[#ff6b9d] focus:ring-2 focus:ring-[#ff6b9d]/20 " +
                      "transition-all duration-200 text-[#4a3f48] placeholder:text-gray-400 " +
                      "box-border min-h-[3.5rem] text-base",
                    
                    // 로그인 버튼
                    formButtonPrimary:
                      "w-full bg-[#ff6b9d] hover:bg-[#ff5088] " +
                      "text-white font-semibold py-3 rounded-lg mt-8 " +
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

