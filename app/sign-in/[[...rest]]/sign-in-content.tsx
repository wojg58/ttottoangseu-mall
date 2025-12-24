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

import {
  SignIn,
  SignedIn,
  SignedOut,
  useAuth,
  useClerk,
  useSignIn,
} from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const redirectUrl = searchParams.get("redirect_url") || "/";

  // 클라이언트 사이드에서만 실행 (useEffect 안으로 이동하여 hydration mismatch 방지)
  useEffect(() => {
    console.group("[SignInContent] 로그인 페이지 초기화");
    console.log("리다이렉트 URL:", redirectUrl);
    console.log("현재 URL:", window.location.href);
    console.groupEnd();
  }, [redirectUrl]);

  // 폼 필드를 세로 레이아웃으로 변경 (라벨 위, 입력칸 아래)
  useEffect(() => {
    // 이미 적용되었는지 추적하는 플래그
    let isEmailFieldApplied = false;
    let isPasswordFieldApplied = false;
    let updateCount = 0;
    const MAX_UPDATES = 10; // 최대 업데이트 횟수 제한
    let buttonObserver: MutationObserver | null = null; // 버튼 텍스트 변경을 위한 Observer

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
      const badges = document.querySelectorAll(
        ".cl-lastAuthenticationStrategyBadge",
      );
      badges.forEach((badge) => {
        const badgeElement = badge as HTMLElement;
        if (badgeElement.style.display !== "none") {
          badgeElement.style.display = "none";
        }
      });

      // 아이디 필드 처리
      const identifierRow = document.querySelector(
        ".cl-formFieldRow__identifier",
      ) as HTMLElement;
      const identifierInput = document.querySelector(
        'input[name="identifier"], input[id="identifier-field"], input[id*="identifier"]',
      ) as HTMLInputElement;
      const identifierLabelRow = identifierRow?.querySelector(
        ".cl-formFieldLabelRow__identifier",
      ) as HTMLElement;
      const identifierLabel = identifierRow?.querySelector(
        ".cl-formFieldLabel__identifier-field",
      ) as HTMLElement;

      if (identifierRow && identifierInput && !isEmailFieldApplied) {
        console.log("[SignInContent] 이메일 주소 입력칸 스타일 적용 및 활성화");

        // 이메일 주소 입력칸 컨테이너 표시 및 활성화
        identifierRow.style.cssText = `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        `;

        // 이메일 주소 입력 필드 활성화
        identifierInput.removeAttribute("disabled");
        identifierInput.removeAttribute("readonly");
        identifierInput.removeAttribute("tabindex");
        identifierInput.setAttribute("tabindex", "0");
        identifierInput.setAttribute("aria-disabled", "false");
        identifierInput.style.pointerEvents = "auto";
        identifierInput.style.cursor = "text";
        identifierInput.style.display = "block";
        identifierInput.style.visibility = "visible";
        identifierInput.style.opacity = "1";

        // placeholder 비우기
        identifierInput.placeholder = "";

        // identifier 필드의 검증 속성 수정
        identifierInput.removeAttribute("pattern");
        identifierInput.setAttribute("type", "email");
        identifierInput.setAttribute("inputmode", "email");
        identifierInput.removeAttribute("aria-invalid");
        identifierInput.setAttribute("aria-invalid", "false");

        // 이메일 입력 후 자동 리다이렉트 방지
        identifierInput.addEventListener("blur", (e) => {
          // 이메일 입력 후 blur 이벤트가 발생해도 페이지 이동을 막지 않음
          // 대신 비밀번호 필드로 포커스 이동
          const passwordInput = document.querySelector(
            'input[name="password"], input[id="password-field"], input[id*="password"]',
          ) as HTMLInputElement;
          if (passwordInput && identifierInput.value) {
            // 비밀번호 필드가 있으면 포커스 이동하지 않음 (사용자가 직접 클릭하도록)
            console.log("[SignInContent] 이메일 입력 완료, 비밀번호 입력 대기");
          }

          // 에러 메시지 제거
          const error = identifierRow.querySelector(
            ".cl-formFieldErrorText",
          ) as HTMLElement;
          if (error) {
            error.style.display = "none";
          }
        });

        // 입력 시 에러 메시지 제거
        identifierInput.addEventListener("input", () => {
          const error = identifierRow.querySelector(
            ".cl-formFieldErrorText",
          ) as HTMLElement;
          if (error) {
            error.style.display = "none";
          }
          // aria-invalid 속성도 false로 설정
          identifierInput.setAttribute("aria-invalid", "false");
        });

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
      const passwordRow = document.querySelector(
        ".cl-formFieldRow__password",
      ) as HTMLElement;
      const passwordInput = document.querySelector(
        'input[name="password"], input[id="password-field"], input[id*="password"]',
      ) as HTMLInputElement;
      const passwordLabelRow = passwordRow?.querySelector(
        ".cl-formFieldLabelRow__password",
      ) as HTMLElement;
      const passwordLabel = passwordRow?.querySelector(
        ".cl-formFieldLabel__password-field",
      ) as HTMLElement;

      if (passwordRow && passwordInput && !isPasswordFieldApplied) {
        console.log("[SignInContent] 비밀번호 입력칸 스타일 적용 및 활성화");

        // 비밀번호 입력칸 컨테이너 표시 및 활성화
        passwordRow.style.cssText = `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        `;

        // placeholder 비우기
        passwordInput.placeholder = "";

        // 비밀번호 필드를 입력 가능하도록 설정
        passwordInput.removeAttribute("disabled");
        passwordInput.removeAttribute("readonly");
        passwordInput.removeAttribute("tabindex");
        passwordInput.setAttribute("tabindex", "0");
        passwordInput.setAttribute("aria-disabled", "false");
        passwordInput.style.pointerEvents = "auto";
        passwordInput.style.cursor = "text";
        passwordInput.style.display = "block";
        passwordInput.style.visibility = "visible";
        passwordInput.style.opacity = "1";

        // 비밀번호 필드 스타일 - 입력 가능하도록
        passwordInput.style.cssText += `
          pointer-events: auto !important;
          cursor: text !important;
          opacity: 1 !important;
          display: block !important;
          visibility: visible !important;
        `;

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

        // 비밀번호 표시/숨김 버튼도 활성화
        const showPasswordButton = passwordRow.querySelector(
          ".cl-formFieldInputShowPasswordButton",
        ) as HTMLElement;
        if (showPasswordButton) {
          showPasswordButton.removeAttribute("tabindex");
          showPasswordButton.setAttribute("tabindex", "0");
          showPasswordButton.style.pointerEvents = "auto";
          showPasswordButton.style.cursor = "pointer";
          console.log("비밀번호 표시/숨김 버튼 활성화");
        }

        // 입력 시 에러 메시지 제거
        passwordInput.addEventListener("input", () => {
          const error = passwordRow.querySelector(
            ".cl-formFieldErrorText, .custom-error-message",
          ) as HTMLElement;
          if (error) {
            error.style.display = "none";
          }
          // aria-invalid 속성도 false로 설정
          passwordInput.setAttribute("aria-invalid", "false");
          // 에러 스타일 제거
          passwordInput.style.borderColor = "";
          passwordInput.style.borderWidth = "";
        });

        isPasswordFieldApplied = true;
      }

      // 필드 순서: 이메일 → 비밀번호
      if (
        identifierRow &&
        passwordRow &&
        isEmailFieldApplied &&
        isPasswordFieldApplied
      ) {
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

      // 오류 메시지 숨기기 및 identifier 검증 수정
      if (identifierRow) {
        // identifier 입력 필드가 항상 보이도록 보장
        if (identifierInput) {
          identifierInput.style.cssText += `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          `;
        }

        // identifier 필드 컨테이너도 보이도록 보장
        const identifierField = identifierRow.querySelector(
          ".cl-formField__identifier",
        ) as HTMLElement;
        if (identifierField) {
          identifierField.style.cssText += `
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          `;
        }

        // 에러 메시지만 숨기기 (입력 필드는 숨기지 않음)
        const identifierError = identifierRow.querySelector(
          ".cl-formFieldErrorText",
        ) as HTMLElement;
        if (identifierError) {
          // "Identifier is invalid." 에러 메시지만 숨기기
          identifierError.style.cssText = `
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          `;
        }
      }

      if (passwordRow) {
        const passwordError = passwordRow.querySelector(
          ".cl-formFieldErrorText",
        ) as HTMLElement;
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
      const loginButton = document.querySelector(
        '.cl-formButtonPrimary, button[type="submit"]',
      ) as HTMLButtonElement;
      const loginButtonContainer = loginButton?.closest(
        ".cl-internal-1pnppin",
      ) as HTMLElement;

      if (loginButton) {
        console.log("로그인 버튼 스타일 적용 및 클릭 가능하도록 설정");

        // 로그인 버튼을 클릭 가능하도록 설정
        loginButton.removeAttribute("disabled");
        loginButton.removeAttribute("tabindex");
        loginButton.setAttribute("tabindex", "0");
        loginButton.setAttribute("aria-disabled", "false");
        loginButton.type = "submit";

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
          pointer-events: auto !important;
          cursor: pointer !important;
        `;

        // 버튼 텍스트를 "로그인"으로 변경 (아이콘 제거)
        const updateButtonText = () => {
          // 1. cl-internal-2iusy0 클래스를 가진 span 요소를 정확히 찾아서 변경
          const continueSpan = loginButton.querySelector(
            "span.cl-internal-2iusy0",
          ) as HTMLElement;
          if (continueSpan) {
            // SVG 아이콘 제거하고 텍스트만 "로그인"으로 변경
            continueSpan.innerHTML = "로그인";
          }

          // 2. cl-internal 클래스를 포함한 모든 span 요소 확인
          const allInternalSpans = loginButton.querySelectorAll(
            "span[class*='cl-internal']",
          );
          allInternalSpans.forEach((span) => {
            const spanElement = span as HTMLElement;
            const textContent = spanElement.textContent || "";
            if (
              textContent.includes("계속") ||
              textContent.includes("Continue") ||
              !textContent.includes("로그인")
            ) {
              // "로그인"이 아닌 경우 무조건 "로그인"으로 변경
              spanElement.innerHTML = "로그인";
            }
          });

          // 3. 모든 span 요소 확인 (아이콘 제거)
          const allSpans = loginButton.querySelectorAll("span");
          allSpans.forEach((span) => {
            const spanElement = span as HTMLElement;
            const textContent = spanElement.textContent || "";
            if (
              textContent.includes("계속") ||
              textContent.includes("Continue")
            ) {
              // SVG 아이콘 제거하고 텍스트만 "로그인"으로 변경
              spanElement.innerHTML = "로그인";
            }
          });

          // 4. 버튼 내의 모든 SVG 아이콘 제거 (화살표 아이콘 등)
          const allSvgs = loginButton.querySelectorAll("svg");
          allSvgs.forEach((svg) => {
            svg.remove();
          });

          // 5. 버튼의 직접 텍스트 노드도 확인
          const walker = document.createTreeWalker(
            loginButton,
            NodeFilter.SHOW_TEXT,
            null,
          );
          let node;
          while ((node = walker.nextNode())) {
            if (
              node.textContent &&
              (node.textContent.includes("계속") ||
                node.textContent.includes("Continue"))
            ) {
              node.textContent = "로그인";
            }
          }

          // 6. 최종 확인: 버튼의 textContent가 "계속"을 포함하면 강제로 변경
          const buttonText = loginButton.textContent || "";
          if (buttonText.includes("계속") || buttonText.includes("Continue")) {
            // 버튼의 모든 자식 요소를 제거하고 "로그인"만 추가
            loginButton.innerHTML = "로그인";
          }
        };

        updateButtonText();

        // MutationObserver로 버튼 내용이 변경될 때마다 다시 적용
        if (buttonObserver) {
          buttonObserver.disconnect();
        }
        buttonObserver = new MutationObserver(() => {
          updateButtonText();
        });

        buttonObserver.observe(loginButton, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // 로그인 버튼 클릭 이벤트 로깅
        loginButton.addEventListener("click", (e) => {
          console.group("[SignInContent] 로그인 버튼 클릭");
          console.log("시간:", new Date().toISOString());
          console.log("버튼 타입:", loginButton.type);
          console.log("버튼 disabled:", loginButton.disabled);
          console.groupEnd();
        });
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
      if (
        now - lastUpdateTime > THROTTLE_MS &&
        (!isEmailFieldApplied || !isPasswordFieldApplied)
      ) {
        lastUpdateTime = now;
        updateForm();
      }
    });

    // Clerk 폼이 렌더링될 컨테이너만 관찰
    const formContainer = document.querySelector(".cl-rootBox, .cl-card, form");
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
      if (buttonObserver) {
        buttonObserver.disconnect();
      }
    };
  }, []);

  // 로그인 성공/실패 감지 및 리다이렉트 처리
  useEffect(() => {
    const handleSignIn = (e: Event) => {
      console.group("[SignInContent] 로그인 시도 감지");
      console.log("시간:", new Date().toISOString());
      console.log("리다이렉트 URL:", redirectUrl);
      console.groupEnd();
    };

    // 폼 제출 이벤트 리스너
    const form = document.querySelector("form.cl-form");
    if (form) {
      form.addEventListener("submit", handleSignIn);
      return () => form.removeEventListener("submit", handleSignIn);
    }
  }, [redirectUrl]);

  // 두 번째 입력 페이지로 이동하는 것을 완전히 방지
  useEffect(() => {
    const preventSecondPageRedirect = () => {
      const currentPath = window.location.pathname;

      // /sign-in/create, /sign-up, 또는 다른 두 번째 입력 페이지로 이동하는 것을 감지
      if (
        (currentPath.includes("/sign-in/") && currentPath !== "/sign-in") ||
        currentPath === "/sign-up" ||
        currentPath.includes("/sign-up/")
      ) {
        console.group(
          "[SignInContent] 두 번째 입력 페이지로 이동 감지, 즉시 차단",
        );
        console.log("현재 경로:", currentPath);
        console.log("시간:", new Date().toISOString());
        console.groupEnd();

        // 즉시 로그인 페이지로 다시 리다이렉트
        window.history.replaceState(null, "", "/sign-in");
        router.replace("/sign-in");
      }
    };

    // 더 빠른 주기로 URL 확인 (100ms)
    const interval = setInterval(preventSecondPageRedirect, 100);

    // popstate 이벤트 리스너 (뒤로가기/앞으로가기)
    window.addEventListener("popstate", preventSecondPageRedirect);

    // pushstate/replacestate 이벤트 감지 및 차단
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const url = typeof args[2] === "string" ? args[2] : "";
      if (url.includes("/sign-in/") && url !== "/sign-in") {
        console.log("[SignInContent] pushState 차단:", url);
        return; // 두 번째 페이지로의 pushState 차단
      }
      originalPushState.apply(history, args);
      setTimeout(preventSecondPageRedirect, 0);
    };

    history.replaceState = function (...args) {
      const url = typeof args[2] === "string" ? args[2] : "";
      if (url.includes("/sign-in/") && url !== "/sign-in") {
        console.log("[SignInContent] replaceState 차단:", url);
        return; // 두 번째 페이지로의 replaceState 차단
      }
      originalReplaceState.apply(history, args);
      setTimeout(preventSecondPageRedirect, 0);
    };

    return () => {
      clearInterval(interval);
      window.removeEventListener("popstate", preventSecondPageRedirect);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [router]);

  // Clerk 폼 제출을 가로채서 바로 로그인 처리
  useEffect(() => {
    const interceptClerkFormSubmit = () => {
      const clerkForm = document.querySelector(
        "form.cl-form",
      ) as HTMLFormElement;
      if (!clerkForm) return;

      // 폼 제출 이벤트 가로채기
      const handleFormSubmit = async (e: SubmitEvent) => {
        console.group(
          "[SignInContent] Clerk 폼 제출 가로채기 - 바로 로그인 처리",
        );
        console.log("시간:", new Date().toISOString());
        console.log("이벤트 타입:", e.type);

        // 기본 동작 방지
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Clerk 폼에서 이메일과 비밀번호 추출
        const identifierInput = clerkForm.querySelector(
          'input[name="identifier"], input[id="identifier-field"], input[id*="identifier"], input[type="email"]',
        ) as HTMLInputElement;
        const passwordInput = clerkForm.querySelector(
          'input[name="password"], input[id="password-field"], input[id*="password"], input[type="password"]',
        ) as HTMLInputElement;

        if (identifierInput && passwordInput) {
          const emailValue = identifierInput.value.trim();
          const passwordValue = passwordInput.value;

          console.log("[SignInContent] 입력값 확인:");
          console.log("  - 이메일 입력 필드:", identifierInput);
          console.log("  - 이메일 값 (raw):", identifierInput.value);
          console.log("  - 이메일 값 (trimmed):", emailValue);
          console.log("  - 이메일 값 길이:", emailValue.length);
          console.log("  - 비밀번호 입력됨:", passwordValue ? "예" : "아니오");
          console.log(
            "  - 비밀번호 값 길이:",
            passwordValue ? passwordValue.length : 0,
          );

          if (emailValue && passwordValue) {
            try {
              // Clerk가 초기화될 때까지 대기 (최대 10초)
              let attempts = 0;
              const maxAttempts = 100; // 10초 (100ms * 100)

              console.log("[SignInContent] Clerk 초기화 대기 시작");

              // Clerk가 완전히 초기화될 때까지 대기 (useSignIn 훅 사용)
              while (attempts < maxAttempts) {
                // 현재 상태 확인
                const currentIsLoaded = isLoaded;
                const currentSignInLoaded = signInLoaded;
                const hasSignIn = signIn !== null && signIn !== undefined;
                const hasSetActive =
                  clerk && typeof clerk.setActive === "function";

                if (
                  currentIsLoaded &&
                  currentSignInLoaded &&
                  hasSignIn &&
                  hasSetActive
                ) {
                  console.log("[SignInContent] Clerk 초기화 확인 완료");
                  break;
                }

                await new Promise((resolve) => setTimeout(resolve, 100));
                attempts++;

                // 주기적으로 상태 확인
                if (attempts % 10 === 0) {
                  console.log(
                    `[SignInContent] 초기화 대기 중... (${attempts * 100}ms)`,
                  );
                  console.log(`  - isLoaded: ${isLoaded}`);
                  console.log(`  - signInLoaded: ${signInLoaded}`);
                  console.log(`  - signIn: ${!!signIn}`);
                  console.log(`  - setActive: ${hasSetActive}`);
                }
              }

              // 최종 확인
              if (!isLoaded || !signInLoaded || !signIn || !clerk?.setActive) {
                console.error(
                  "[SignInContent] Clerk가 초기화되지 않음 (타임아웃)",
                );
                console.error(
                  "최종 상태 - isLoaded:",
                  isLoaded,
                  "signInLoaded:",
                  signInLoaded,
                  "signIn:",
                  !!signIn,
                  "setActive:",
                  !!clerk?.setActive,
                );

                // 페이지 새로고침 제안
                const shouldReload = confirm(
                  "Clerk가 아직 초기화되지 않았습니다. 페이지를 새로고침하시겠습니까?",
                );
                if (shouldReload) {
                  window.location.reload();
                }
                return;
              }

              console.log(
                "[SignInContent] Clerk 초기화 확인 완료, 로그인 시작",
              );

              // 1단계: 이메일로 signIn 생성
              console.log("[SignInContent] SignIn.create 호출 중...");
              console.log("[SignInContent] 전달할 identifier:", emailValue);
              console.log(
                "[SignInContent] identifier 타입:",
                typeof emailValue,
              );
              console.log(
                "[SignInContent] identifier 길이:",
                emailValue.length,
              );

              const signInAttempt = await signIn.create({
                identifier: emailValue,
              });

              console.log("[SignInContent] SignIn.create 응답:", signInAttempt);

              console.log(
                "[SignInContent] SignIn 생성 완료, 비밀번호 인증 시도",
              );

              // 2단계: 비밀번호로 인증 시도
              console.log("[SignInContent] attemptFirstFactor 호출 중...");
              const result = await signInAttempt.attemptFirstFactor({
                strategy: "password",
                password: passwordValue,
              });

              console.log("[SignInContent] 로그인 성공, 상태:", result.status);
              console.log("[SignInContent] result 전체:", result);

              // 로그인 성공 후 세션 활성화 및 리다이렉트
              if (result.status === "complete") {
                console.log("[SignInContent] 로그인 완료, 세션 활성화 시작");
                console.log(
                  "[SignInContent] result.createdSessionId:",
                  result.createdSessionId,
                );
                console.log(
                  "[SignInContent] clerk.setActive 존재:",
                  !!clerk?.setActive,
                );

                // 세션 활성화
                if (result.createdSessionId && clerk.setActive) {
                  try {
                    console.log(
                      "[SignInContent] setActive 호출 중, sessionId:",
                      result.createdSessionId,
                    );
                    await clerk.setActive({ session: result.createdSessionId });
                    console.log("[SignInContent] setActive 완료");

                    // setActive 후 세션 동기화를 위해 약간의 딜레이
                    await new Promise((resolve) => setTimeout(resolve, 1000));

                    console.log(
                      "[SignInContent] 세션 활성화 완료, 리다이렉트 시작",
                    );
                    // window.location.href를 사용하여 전체 페이지 리로드로 세션 상태를 확실히 반영
                    // 이렇게 하면 구글 로그인과 동일하게 세션이 확실히 활성화됨
                    window.location.href = redirectUrl;
                  } catch (setActiveError: any) {
                    console.error(
                      "[SignInContent] setActive 실패:",
                      setActiveError,
                    );
                    console.error("[SignInContent] 에러 상세:", {
                      message: setActiveError.message,
                      errors: setActiveError.errors,
                      status: setActiveError.status,
                    });
                    alert(
                      "세션 활성화에 실패했습니다. 페이지를 새로고침해주세요.",
                    );
                    window.location.reload();
                    return;
                  }
                } else {
                  console.warn(
                    "[SignInContent] createdSessionId 또는 setActive가 없음",
                  );
                  console.warn(
                    "[SignInContent] createdSessionId:",
                    result.createdSessionId,
                  );
                  console.warn(
                    "[SignInContent] setActive:",
                    !!clerk?.setActive,
                  );

                  // createdSessionId가 없으면 페이지 새로고침으로 세션 상태 확인
                  console.log(
                    "[SignInContent] 페이지 새로고침으로 세션 상태 확인",
                  );
                  window.location.href = redirectUrl;
                }
              } else {
                console.warn(
                  "[SignInContent] 로그인 상태가 complete가 아님:",
                  result.status,
                );
                alert("로그인을 완료할 수 없습니다. 다시 시도해주세요.");
              }
            } catch (err: any) {
              console.error("[SignInContent] 로그인 실패:", err);
              console.error("[SignInContent] 에러 상세:", {
                message: err.message,
                errors: err.errors,
                status: err.status,
                statusCode: err.statusCode,
              });

              // 에러 코드 확인
              const errorCode = err.errors?.[0]?.code;
              console.error("[SignInContent] 에러 코드:", errorCode);
              console.error(
                "[SignInContent] 에러 전체 객체:",
                JSON.stringify(err, null, 2),
              );

              // 에러 메시지 추출
              let errorMessage = "로그인에 실패했습니다.";
              let errorField: "email" | "password" | "general" = "general";

              if (err.errors && err.errors.length > 0) {
                const firstError = err.errors[0];
                errorMessage =
                  firstError.message || firstError.longMessage || errorMessage;

                // 에러 코드 기반 처리
                if (errorCode === "form_identifier_not_found") {
                  errorMessage =
                    "등록되지 않은 이메일 주소입니다. 회원가입을 먼저 진행해주세요.";
                  errorField = "email";
                } else if (errorCode === "form_password_incorrect") {
                  errorMessage = "비밀번호가 올바르지 않습니다.";
                  errorField = "password";
                } else if (errorCode === "form_identifier_invalid") {
                  errorMessage = "이메일 주소 형식이 올바르지 않습니다.";
                  errorField = "email";
                }
              } else if (err.message) {
                errorMessage = err.message;
              }

              // 사용자 친화적인 메시지로 변환 (에러 코드가 없을 경우)
              if (
                errorMessage.includes("identifier") ||
                errorMessage.includes("email") ||
                errorMessage.includes("Couldn't find your account") ||
                errorMessage.includes("not found")
              ) {
                if (!errorCode || errorCode !== "form_identifier_not_found") {
                  errorMessage = "이메일 주소를 확인해주세요.";
                  errorField = "email";
                }
              } else if (
                errorMessage.includes("password") ||
                errorMessage.includes("incorrect")
              ) {
                if (!errorCode || errorCode !== "form_password_incorrect") {
                  errorMessage = "비밀번호가 올바르지 않습니다.";
                  errorField = "password";
                }
              }

              // 에러 메시지를 Clerk 폼에 표시
              const identifierRow = clerkForm.querySelector(
                ".cl-formFieldRow__identifier",
              ) as HTMLElement;
              const passwordRow = clerkForm.querySelector(
                ".cl-formFieldRow__password",
              ) as HTMLElement;

              // 기존 에러 메시지 제거
              const existingErrors = clerkForm.querySelectorAll(
                ".cl-formFieldErrorText, .custom-error-message",
              );
              existingErrors.forEach((error) => {
                (error as HTMLElement).style.display = "none";
              });

              // 에러 메시지 표시
              if (errorField === "email" && identifierRow) {
                // 이메일 필드에 에러 표시
                let errorElement = identifierRow.querySelector(
                  ".custom-error-message",
                ) as HTMLElement;
                if (!errorElement) {
                  errorElement = document.createElement("div");
                  errorElement.className = "custom-error-message";
                  errorElement.style.cssText = `
                    color: #dc2626;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                    display: block;
                  `;
                  const identifierInput = identifierRow.querySelector(
                    'input[name="identifier"], input[id*="identifier"]',
                  );
                  if (identifierInput && identifierInput.parentElement) {
                    identifierInput.parentElement.appendChild(errorElement);
                  }
                }
                errorElement.textContent = errorMessage;
                errorElement.style.display = "block";

                // 입력 필드에 에러 스타일 적용
                const identifierInput = identifierRow.querySelector(
                  'input[name="identifier"], input[id*="identifier"]',
                ) as HTMLInputElement;
                if (identifierInput) {
                  identifierInput.style.borderColor = "#dc2626";
                  identifierInput.style.borderWidth = "1px";
                  identifierInput.setAttribute("aria-invalid", "true");
                }
              } else if (errorField === "password" && passwordRow) {
                // 비밀번호 필드에 에러 표시
                let errorElement = passwordRow.querySelector(
                  ".custom-error-message",
                ) as HTMLElement;
                if (!errorElement) {
                  errorElement = document.createElement("div");
                  errorElement.className = "custom-error-message";
                  errorElement.style.cssText = `
                    color: #dc2626;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                    display: block;
                  `;
                  const passwordInput = passwordRow.querySelector(
                    'input[name="password"], input[id*="password"]',
                  );
                  if (passwordInput && passwordInput.parentElement) {
                    passwordInput.parentElement.appendChild(errorElement);
                  }
                }
                errorElement.textContent = errorMessage;
                errorElement.style.display = "block";

                // 입력 필드에 에러 스타일 적용
                const passwordInput = passwordRow.querySelector(
                  'input[name="password"], input[id*="password"]',
                ) as HTMLInputElement;
                if (passwordInput) {
                  passwordInput.style.borderColor = "#dc2626";
                  passwordInput.style.borderWidth = "1px";
                  passwordInput.setAttribute("aria-invalid", "true");
                }
              } else {
                // 일반 에러는 폼 상단에 표시
                let generalError = clerkForm.querySelector(
                  ".custom-general-error",
                ) as HTMLElement;
                if (!generalError) {
                  generalError = document.createElement("div");
                  generalError.className = "custom-general-error";
                  generalError.style.cssText = `
                    color: #dc2626;
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                    padding: 0.75rem;
                    background-color: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 0.5rem;
                    display: block;
                  `;
                  clerkForm.insertBefore(generalError, clerkForm.firstChild);
                }
                generalError.textContent = errorMessage;
                generalError.style.display = "block";
              }
            }
          } else {
            alert("이메일과 비밀번호를 모두 입력해주세요.");
          }
        }

        console.groupEnd();
        return false;
      };

      // 폼 제출 이벤트 리스너 추가
      clerkForm.addEventListener("submit", handleFormSubmit, true); // capture phase에서 실행

      // 버튼 텍스트를 "로그인"으로 변경 및 클릭 이벤트 가로채기
      const loginButton = clerkForm.querySelector(
        '.cl-formButtonPrimary, button[type="submit"]',
      ) as HTMLButtonElement;
      if (loginButton) {
        // 버튼 텍스트를 무조건 "로그인"으로 변경하는 함수
        const updateButtonText = () => {
          console.log("[SignInContent] 버튼 텍스트를 '로그인'으로 변경 시도");

          // 1. cl-internal-2iusy0 클래스를 가진 span 요소를 정확히 찾아서 변경
          const continueSpan = loginButton.querySelector(
            "span.cl-internal-2iusy0",
          ) as HTMLElement;
          if (continueSpan) {
            console.log(
              "[SignInContent] cl-internal-2iusy0 span 요소 발견, 텍스트 변경 및 아이콘 제거",
            );
            // SVG 아이콘 제거하고 텍스트만 "로그인"으로 변경
            continueSpan.innerHTML = "로그인";
            console.log(
              "[SignInContent] span innerHTML을 '로그인'으로 변경 (아이콘 제거)",
            );
          }

          // 2. cl-internal 클래스를 포함한 모든 span 요소 확인
          const allInternalSpans = loginButton.querySelectorAll(
            "span[class*='cl-internal']",
          );
          allInternalSpans.forEach((span) => {
            const spanElement = span as HTMLElement;
            const textContent = spanElement.textContent || "";
            if (
              textContent.includes("계속") ||
              textContent.includes("Continue") ||
              !textContent.includes("로그인")
            ) {
              // "로그인"이 아닌 경우 무조건 "로그인"으로 변경
              spanElement.innerHTML = "로그인";
              console.log(
                "[SignInContent] cl-internal span 요소에서 '로그인'으로 변경",
              );
            }
          });

          // 3. 버튼의 모든 span 요소 확인하여 텍스트 변경 (아이콘 제거)
          const allSpans = loginButton.querySelectorAll("span");
          allSpans.forEach((span) => {
            const spanElement = span as HTMLElement;
            const textContent = spanElement.textContent || "";
            if (
              textContent.includes("계속") ||
              textContent.includes("Continue")
            ) {
              // SVG 아이콘 제거하고 텍스트만 "로그인"으로 변경
              spanElement.innerHTML = "로그인";
              console.log(
                "[SignInContent] span 요소에서 '계속'을 '로그인'으로 변경 (아이콘 제거)",
              );
            }
          });

          // 4. 버튼 내의 모든 SVG 아이콘 제거 (화살표 아이콘 등)
          const allSvgs = loginButton.querySelectorAll("svg");
          allSvgs.forEach((svg) => {
            svg.remove();
            console.log("[SignInContent] SVG 아이콘 제거");
          });

          // 5. 버튼의 모든 텍스트 노드 찾아서 변경
          const walker = document.createTreeWalker(
            loginButton,
            NodeFilter.SHOW_TEXT,
            null,
          );
          let node;
          while ((node = walker.nextNode())) {
            if (
              node.textContent &&
              (node.textContent.includes("계속") ||
                node.textContent.includes("Continue"))
            ) {
              node.textContent = "로그인";
              console.log(
                "[SignInContent] 텍스트 노드에서 '계속'을 '로그인'으로 변경",
              );
            }
          }

          // 6. 최종 확인: 버튼의 textContent가 "계속"을 포함하면 강제로 변경
          const buttonText = loginButton.textContent || "";
          if (buttonText.includes("계속") || buttonText.includes("Continue")) {
            // 버튼의 모든 자식 요소를 제거하고 "로그인"만 추가
            const buttonSvg = loginButton.querySelector("svg");
            loginButton.innerHTML = "로그인";
            console.log(
              "[SignInContent] 버튼 전체 내용을 '로그인'으로 강제 변경",
            );
          }
        };

        // 즉시 실행
        updateButtonText();

        // MutationObserver로 버튼 내용이 변경될 때마다 다시 적용
        const buttonObserver = new MutationObserver(() => {
          updateButtonText();
        });

        buttonObserver.observe(loginButton, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // 버튼 클릭 이벤트도 가로채기 (폼 제출과 동일한 처리)
        const handleButtonClick = async (e: MouseEvent) => {
          console.log("[SignInContent] 로그인 버튼 클릭 감지");
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // 폼 제출 이벤트를 트리거하여 handleFormSubmit이 실행되도록
          const formEvent = new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
          });
          handleFormSubmit(formEvent);
        };

        loginButton.addEventListener("click", handleButtonClick, true);

        // cleanup 함수에 버튼 클릭 이벤트 리스너 제거 추가
        return () => {
          clerkForm.removeEventListener("submit", handleFormSubmit, true);
          loginButton.removeEventListener("click", handleButtonClick, true);
          buttonObserver.disconnect();
        };
      } else {
        return () => {
          clerkForm.removeEventListener("submit", handleFormSubmit, true);
        };
      }
    };

    // 초기 실행 및 주기적 확인
    const initialTimeout = setTimeout(interceptClerkFormSubmit, 500);
    const interval = setInterval(interceptClerkFormSubmit, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [clerk, signIn, signInLoaded, router, redirectUrl, isLoaded, isSignedIn]);

  // 로그인 성공 후 리다이렉트 처리
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.group("[SignInContent] 로그인 성공 감지");
      console.log("리다이렉트 URL로 이동:", redirectUrl);
      console.log("시간:", new Date().toISOString());
      console.log("isSignedIn:", isSignedIn);
      console.log("isLoaded:", isLoaded);
      console.groupEnd();

      // 리다이렉트 실행 (약간의 딜레이를 두어 사용자 동기화가 완료될 시간을 줌)
      setTimeout(() => {
        router.push(redirectUrl);
      }, 1000);
    } else if (isLoaded && !isSignedIn) {
      // 로그인 페이지에 있는데 isSignedIn이 false인 경우 로그만 출력
      console.log(
        "[SignInContent] isLoaded는 true이지만 isSignedIn이 false입니다.",
      );
    }
  }, [isLoaded, isSignedIn, redirectUrl, router]);

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
                이메일주소와 비밀번호를 입력해주세요
              </p>
            </div>

            {/* 로그인 폼 카드 */}
            <div className="bg-white rounded-lg p-8 md:p-12 shadow-sm border border-gray-200 min-h-[500px]">
              {/* 소셜 로그인 버튼 (Clerk 기본) - 이메일/비밀번호 필드는 숨김 */}
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl={null}
                afterSignInUrl={redirectUrl}
                fallbackRedirectUrl={redirectUrl}
                forceRedirectUrl={redirectUrl}
                redirectUrl={redirectUrl}
                appearance={{
                  elements: {
                    rootBox: "mx-auto",
                    card: "shadow-none bg-transparent",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    // 소셜 버튼 표시
                    socialButtonsBlockButton: "block",
                    dividerRow: "block",

                    // 이메일/비밀번호 필드 표시
                    formFieldRow__identifier: "block",
                    formFieldRow__password: "block",
                    form: "block",

                    // 로그인 버튼 스타일
                    formButtonPrimary:
                      "w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md",

                    // 푸터 링크
                    footerActionLink:
                      "text-[#ff6b9d] hover:text-[#ff5088] font-medium",
                  },
                }}
              />
            </div>

            {/* 회원가입 링크 */}
            <div className="mt-6 text-center">
              <p className="text-sm text-[#8b7d84]">
                계정이 없으신가요?{" "}
                <Link
                  href="/sign-up/join"
                  className="text-[#ff6b9d] hover:text-[#ff5088] font-semibold transition-colors"
                  onClick={(e) => {
                    console.log(
                      "[SignInContent] 회원가입 페이지로 이동: /sign-up/join",
                    );
                    router.push("/sign-up/join");
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
