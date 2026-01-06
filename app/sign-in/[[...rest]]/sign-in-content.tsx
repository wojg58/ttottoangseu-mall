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
import { useEffect, useRef } from "react";

export default function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const redirectUrl = searchParams.get("redirect_url") || "/";
  const kakaoButtonRef = useRef<HTMLButtonElement>(null);
  const naverButtonRef = useRef<HTMLButtonElement>(null);

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
    let labelObserver: MutationObserver | null = null; // 라벨 텍스트 변경을 위한 Observer

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

      // 소셜 버튼 컨테이너를 세로 배치로 변경 (구글 버튼 하나로 꽉 채우기)
      const socialButtonsRoot = document.querySelector(
        ".cl-socialButtonsRoot",
      ) as HTMLElement;
      if (socialButtonsRoot) {
        socialButtonsRoot.style.cssText = `
          display: flex !important;
          flex-direction: column !important;
          gap: 0.75rem !important;
          width: 100% !important;
          margin-bottom: 18.9px !important;
        `;
      }

      // 각 소셜 버튼 컨테이너도 flex로 설정
      const socialButtons = document.querySelectorAll(
        ".cl-socialButtons",
      ) as NodeListOf<HTMLElement>;
      socialButtons.forEach((container) => {
        // 구글 버튼이 있는 컨테이너만 보이도록 설정
        const hasGoogleButton = container.querySelector(
          ".cl-socialButtonsBlockButton__google",
        );
        if (hasGoogleButton) {
          container.style.cssText = `
            display: flex !important;
            width: 100% !important;
            min-width: 0 !important;
          `;
        } else {
          // 빈 컨테이너는 숨기기
          container.style.cssText = `
            display: none !important;
          `;
        }
      });

      // 소셜 버튼들도 flex로 설정
      const socialButtonsBlockButton = document.querySelectorAll(
        ".cl-socialButtonsBlockButton",
      ) as NodeListOf<HTMLElement>;
      socialButtonsBlockButton.forEach((button) => {
        button.style.cssText += `
          width: 100% !important;
          min-width: 0 !important;
          height: 32px !important;
        `;
      });

      const socialButtonsIconButton = document.querySelectorAll(
        ".cl-socialButtonsIconButton",
      ) as NodeListOf<HTMLElement>;
      socialButtonsIconButton.forEach((button) => {
        button.style.cssText += `
          width: 100% !important;
          min-width: 0 !important;
          flex: 1 !important;
        `;
      });

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

      // dividerRow (구분선) 간격 조정
      const dividerRow = document.querySelector(
        ".cl-dividerRow",
      ) as HTMLElement;
      if (dividerRow) {
        dividerRow.style.cssText += `
          margin-top: 0 !important;
          margin-bottom: 18.9px !important;
        `;
      }

      // Clerk 에러 메시지 숨기기 (OAuth 콜백 후 발생하는 에러)
      const hideErrorAlerts = () => {
        const errorAlerts = document.querySelectorAll(
          ".cl-alert, .cl-alertText, [role='alert'], .cl-formFieldErrorText",
        );
        errorAlerts.forEach((alert) => {
          const alertElement = alert as HTMLElement;
          const alertText = alertElement.textContent || "";
          // "Unable to complete action" 및 "External Account was not found" 에러 메시지 숨기기
          if (
            alertText.includes("Unable to complete action") ||
            alertText.includes("문제가 지속되면") ||
            alertText.includes("If the problem persists") ||
            alertText.includes("External Account was not found") ||
            alertText.includes("외부 계정을 찾을 수 없습니다")
          ) {
            console.log("[SignInContent] Clerk 에러 메시지 숨김:", alertText);
            alertElement.style.cssText = `
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            `;
          }
        });
      };

      hideErrorAlerts();

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

        // 라벨 텍스트를 "이메일 주소"로 변경
        if (identifierLabel) {
          identifierLabel.textContent = "이메일 주소";
          console.log("[SignInContent] 라벨 텍스트를 '이메일 주소'로 변경");

          // 기존 observer가 있으면 해제
          if (labelObserver) {
            labelObserver.disconnect();
          }

          // 라벨이 동적으로 변경되어도 "이메일 주소"로 유지
          labelObserver = new MutationObserver(() => {
            if (
              identifierLabel &&
              identifierLabel.textContent !== "이메일 주소"
            ) {
              identifierLabel.textContent = "이메일 주소";
              console.log(
                "[SignInContent] 라벨 텍스트를 '이메일 주소'로 재변경",
              );
            }
          });

          labelObserver.observe(identifierLabel, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }

        // 이메일 주소 입력칸 컨테이너 표시 및 활성화
        identifierRow.style.cssText = `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          margin-bottom: 18.9px !important;
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
        identifierInput.addEventListener("blur", () => {
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
            margin-top: 0 !important;
            visibility: visible !important;
            opacity: 1 !important;
          `;
        }
        if (passwordLabel) {
          passwordLabel.style.cssText = `
            display: block !important;
            margin-bottom: 0.5rem !important;
            margin-top: 0 !important;
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
        loginButton.addEventListener("click", () => {
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

    // 에러 메시지 주기적 확인 및 숨기기
    const hideErrorAlerts = () => {
      const errorAlerts = document.querySelectorAll(
        ".cl-alert, .cl-alertText, [role='alert'], .cl-formFieldErrorText",
      );
      errorAlerts.forEach((alert) => {
        const alertElement = alert as HTMLElement;
        const alertText = alertElement.textContent || "";
        // "Unable to complete action" 및 "External Account was not found" 에러 메시지 숨기기
        if (
          alertText.includes("Unable to complete action") ||
          alertText.includes("문제가 지속되면") ||
          alertText.includes("If the problem persists") ||
          alertText.includes("External Account was not found") ||
          alertText.includes("외부 계정을 찾을 수 없습니다")
        ) {
          console.log("[SignInContent] Clerk 에러 메시지 숨김:", alertText);
          alertElement.style.cssText = `
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          `;
        }
      });
    };

    // 주기적으로 에러 메시지 확인 및 숨기기
    const errorCheckInterval = setInterval(hideErrorAlerts, 500);

    return () => {
      clearTimeout(initialTimeout);
      observer.disconnect();
      if (buttonObserver) {
        buttonObserver.disconnect();
      }
      if (labelObserver) {
        labelObserver.disconnect();
      }
      clearInterval(errorCheckInterval);
    };
  }, []);

  // 로그인 성공/실패 감지 및 리다이렉트 처리
  useEffect(() => {
    const handleSignIn = () => {
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
    let isIntercepted = false; // 이미 가로채기 설정되었는지 확인하는 플래그
    let cleanupFunctions: (() => void)[] = []; // cleanup 함수들을 저장

    const interceptClerkFormSubmit = () => {
      // 이미 설정되었으면 실행하지 않음 (중복 방지)
      if (isIntercepted) return;

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
          let emailValue = identifierInput.value.trim();
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

          // 이메일 형식 검증
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailValue && !emailRegex.test(emailValue)) {
            console.error("[SignInContent] 이메일 형식이 올바르지 않음:", emailValue);
            alert("올바른 이메일 주소 형식을 입력해주세요.\n예: example@email.com");
            return;
          }

          // 빈 값 체크
          if (!emailValue || emailValue.length === 0) {
            console.error("[SignInContent] 이메일 값이 비어있음");
            alert("이메일 주소를 입력해주세요.");
            return;
          }

          if (!passwordValue || passwordValue.length === 0) {
            console.error("[SignInContent] 비밀번호 값이 비어있음");
            alert("비밀번호를 입력해주세요.");
            return;
          }

          // 추가 공백 제거 및 정규화
          // 보이지 않는 문자 제거 (zero-width space, non-breaking space 등)
          emailValue = emailValue
            .toLowerCase()
            .trim()
            .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width characters 제거
            .replace(/\u00A0/g, " ") // Non-breaking space를 일반 공백으로 변환
            .replace(/\s+/g, "") // 모든 공백 제거
            .replace(/[^\x00-\x7F]/g, (char) => {
              // ASCII가 아닌 문자는 유지하되, 특수한 경우만 허용
              // 이메일 주소에서 일반적으로 사용되는 문자만 허용
              return char;
            });

          console.log("[SignInContent] 최종 검증된 이메일:", emailValue);
          console.log("[SignInContent] 이메일 정제 후 길이:", emailValue.length);

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

              // 이메일과 비밀번호를 함께 전달하여 로그인 시도
              console.log("[SignInContent] SignIn.create 호출 중...");
              console.log("[SignInContent] 전달할 identifier:", emailValue);
              console.log("[SignInContent] 전달할 password:", passwordValue ? "***" : "(없음)");
              console.log(
                "[SignInContent] identifier 타입:",
                typeof emailValue,
              );
              console.log(
                "[SignInContent] identifier 길이:",
                emailValue.length,
              );
              console.log(
                "[SignInContent] identifier 문자 코드:",
                Array.from(emailValue).map((char) => char.charCodeAt(0)),
              );
              console.log(
                "[SignInContent] identifier JSON:",
                JSON.stringify(emailValue),
              );

              // 최종 검증: 이메일 형식 재확인
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(emailValue)) {
                console.error(
                  "[SignInContent] 최종 검증 실패 - 이메일 형식이 올바르지 않음:",
                  emailValue,
                );
                alert("올바른 이메일 주소 형식을 입력해주세요.\n예: example@email.com");
                return;
              }

              // Clerk 로그인: 두 단계 방식으로 처리
              // 1단계: identifier만으로 signIn 생성
              // 2단계: password로 인증 시도
              let signInAttempt;
              let result;

              try {
                // 1단계: identifier만으로 signIn 생성
                console.log("[SignInContent] 1단계: identifier만으로 SignIn.create 호출");
                console.log("[SignInContent] 전달할 identifier 값:", {
                  value: emailValue,
                  type: typeof emailValue,
                  length: emailValue.length,
                  charCodes: Array.from(emailValue).map((char) => char.charCodeAt(0)),
                  json: JSON.stringify(emailValue),
                });

                signInAttempt = await signIn.create({
                  identifier: emailValue,
                });

                console.log("[SignInContent] SignIn.create 성공, 응답:", signInAttempt);
                console.log("[SignInContent] SignIn 상태:", signInAttempt.status);

                // 2단계: 비밀번호로 인증 시도
                console.log("[SignInContent] 2단계: 비밀번호로 인증 시도");
                console.log("[SignInContent] attemptFirstFactor 호출 중...");
                console.log("[SignInContent] 현재 환경:", {
                  isProduction: window.location.hostname !== "localhost",
                  hostname: window.location.hostname,
                  protocol: window.location.protocol,
                  href: window.location.href,
                });

                result = await signInAttempt.attemptFirstFactor({
                  strategy: "password",
                  password: passwordValue,
                });

                console.log("[SignInContent] attemptFirstFactor 성공, 상태:", result.status);
              } catch (error: any) {
                // 에러 상세 로깅
                console.error("[SignInContent] 로그인 과정에서 에러 발생:", error);
                console.error("[SignInContent] 에러 타입:", typeof error);
                console.error("[SignInContent] 에러 이름:", error?.name);
                console.error("[SignInContent] 에러 메시지:", error?.message);
                console.error("[SignInContent] 에러 코드:", error?.errors?.[0]?.code);
                console.error("[SignInContent] 에러 전체:", JSON.stringify(error, null, 2));

                // 에러를 다시 throw하여 상위 catch 블록에서 처리
                throw error;
              }

              console.log("[SignInContent] 로그인 성공, 상태:", result.status);
              console.log("[SignInContent] result 전체:", result);
              console.log(
                "[SignInContent] createdSessionId:",
                result.createdSessionId,
              );

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

                    // 프로덕션 환경에서 세션 활성화 재시도 로직
                    let setActiveSuccess = false;
                    let lastError: any = null;

                    for (let attempt = 1; attempt <= 3; attempt++) {
                      try {
                        console.log(
                          `[SignInContent] setActive 시도 ${attempt}/3`,
                        );
                        await clerk.setActive({
                          session: result.createdSessionId,
                        });
                        setActiveSuccess = true;
                        console.log("[SignInContent] setActive 완료");
                        break;
                      } catch (retryError: any) {
                        lastError = retryError;
                        console.warn(
                          `[SignInContent] setActive 시도 ${attempt} 실패:`,
                          retryError,
                        );

                        if (attempt < 3) {
                          // 재시도 전 대기
                          await new Promise((resolve) =>
                            setTimeout(resolve, 500 * attempt),
                          );
                        }
                      }
                    }

                    if (!setActiveSuccess) {
                      throw lastError || new Error("setActive 실패");
                    }

                    // setActive 후 세션 동기화를 위해 약간의 딜레이
                    await new Promise((resolve) => setTimeout(resolve, 1000));

                    console.log(
                      "[SignInContent] 세션 활성화 완료, 리다이렉트 시작",
                    );
                    console.log("[SignInContent] 리다이렉트 URL:", redirectUrl);

                    // 프로덕션 환경에서는 절대 경로로 리다이렉트
                    const redirectPath = redirectUrl.startsWith("http")
                      ? redirectUrl
                      : `${window.location.origin}${redirectUrl}`;

                    console.log(
                      "[SignInContent] 최종 리다이렉트 경로:",
                      redirectPath,
                    );

                    // window.location.href를 사용하여 전체 페이지 리로드로 세션 상태를 확실히 반영
                    // 이렇게 하면 구글 로그인과 동일하게 세션이 확실히 활성화됨
                    window.location.href = redirectPath;
                  } catch (setActiveError: any) {
                    console.error(
                      "[SignInContent] setActive 실패:",
                      setActiveError,
                    );
                    console.error("[SignInContent] 에러 상세:", {
                      message: setActiveError.message,
                      errors: setActiveError.errors,
                      status: setActiveError.status,
                      stack: setActiveError.stack,
                    });

                    // 프로덕션 환경에서의 에러 메시지 개선
                    const isProduction =
                      window.location.hostname !== "localhost";
                    const errorMessage = isProduction
                      ? "세션 활성화에 실패했습니다.\n\n" +
                        "브라우저 쿠키 설정을 확인해주세요:\n" +
                        "1. 쿠키가 차단되지 않았는지 확인\n" +
                        "2. 시크릿 모드가 아닌지 확인\n" +
                        "3. 페이지를 새로고침해주세요"
                      : "세션 활성화에 실패했습니다. 페이지를 새로고침해주세요.";

                    alert(errorMessage);

                    // 프로덕션에서는 리다이렉트를 시도하고, 실패하면 새로고침
                    if (isProduction) {
                      try {
                        window.location.href = redirectUrl;
                        // 리다이렉트가 실패하면 새로고침
                        setTimeout(() => {
                          window.location.reload();
                        }, 2000);
                      } catch {
                        window.location.reload();
                      }
                    } else {
                      window.location.reload();
                    }
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
                console.warn(
                  "[SignInContent] result 전체:",
                  JSON.stringify(result, null, 2),
                );

                // 상태별 안내 메시지
                let errorMessage =
                  "로그인을 완료할 수 없습니다. 다시 시도해주세요.";

                if (result.status === "needs_new_password") {
                  errorMessage = "비밀번호를 재설정해야 합니다.";
                  alert(errorMessage);
                } else if (result.status === "needs_second_factor") {
                  // 2단계 인증이 필요한 경우 자동으로 이메일 코드 전송
                  console.log("[SignInContent] 2단계 인증 필요, 자동 처리 시작");
                  console.log("[SignInContent] supportedSecondFactors:", result.supportedSecondFactors);
                  
                  try {
                    // 이메일 코드 전송 (email_code 전략 사용)
                    const emailCodeStrategy = result.supportedSecondFactors?.find(
                      (factor: any) => factor.strategy === "email_code"
                    );
                    
                    if (emailCodeStrategy) {
                      console.log("[SignInContent] 이메일 코드 전송 시작");
                      // 2단계 인증 코드 전송
                      await signInAttempt.prepareSecondFactor({
                        strategy: "email_code",
                      });
                      
                      console.log("[SignInContent] 이메일 코드 전송 완료");
                      console.log("[SignInContent] 이메일 코드 입력 UI가 자동으로 표시됩니다");
                      // 이메일 코드 입력 UI가 자동으로 표시됨 (Clerk가 처리)
                      // 사용자가 코드를 입력하면 자동으로 인증 완료됨
                      // alert 없이 계속 진행 (Clerk UI가 자동으로 표시됨)
                      return;
                    } else {
                      // email_code 전략이 없는 경우
                      console.warn("[SignInContent] email_code 전략을 찾을 수 없음");
                      errorMessage = "2단계 인증이 필요합니다. 이메일을 확인해주세요.";
                      alert(errorMessage);
                    }
                  } catch (mfaError: any) {
                    console.error("[SignInContent] 2단계 인증 처리 중 에러:", mfaError);
                    console.error("[SignInContent] 에러 상세:", {
                      message: mfaError.message,
                      errors: mfaError.errors,
                      status: mfaError.status,
                    });
                    errorMessage = "2단계 인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
                    alert(errorMessage);
                  }
                } else if (result.status === "needs_identifier") {
                  errorMessage = "로그인 정보를 확인해주세요.";
                  alert(errorMessage);
                } else if (result.status === "needs_first_factor") {
                  errorMessage = "추가 인증이 필요합니다.";
                  alert(errorMessage);
                } else {
                  errorMessage = `로그인 상태: ${result.status}\n\n로그인을 완료할 수 없습니다. 다시 시도해주세요.`;
                  alert(errorMessage);
                }
              }
            } catch (err: any) {
              const isProduction = window.location.hostname !== "localhost";

              console.error("[SignInContent] 로그인 실패:", err);
              console.error("[SignInContent] 환경 정보:", {
                isProduction,
                hostname: window.location.hostname,
                protocol: window.location.protocol,
                href: window.location.href,
              });
              console.error("[SignInContent] 에러 상세:", {
                message: err.message,
                errors: err.errors,
                status: err.status,
                statusCode: err.statusCode,
                name: err.name,
                stack: err.stack,
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
                } else if (
                  errorCode === "form_identifier_invalid" ||
                  errorCode === "form_param_format_invalid"
                ) {
                  errorMessage =
                    "이메일 주소 형식이 올바르지 않습니다.\n\n올바른 형식: example@email.com";
                  errorField = "email";
                }
              } else if (err.message) {
                errorMessage = err.message;
              }

              // 네트워크 에러 또는 CORS 에러 확인
              if (
                err.message?.includes("Network") ||
                err.message?.includes("Failed to fetch") ||
                err.message?.includes("CORS") ||
                err.name === "NetworkError" ||
                err.name === "TypeError"
              ) {
                errorMessage = isProduction
                  ? "네트워크 연결에 문제가 있습니다.\n\n" +
                    "다음을 확인해주세요:\n" +
                    "1. 인터넷 연결 상태 확인\n" +
                    "2. 브라우저를 새로고침한 후 다시 시도\n" +
                    "3. 다른 브라우저에서 시도"
                  : "네트워크 연결에 문제가 있습니다. 다시 시도해주세요.";
                errorField = "general";
              }
              // 사용자 친화적인 메시지로 변환 (에러 코드가 없을 경우)
              else if (
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
        let isUpdating = false; // 무한 루프 방지 플래그
        const updateButtonText = () => {
          // 이미 업데이트 중이면 실행하지 않음 (무한 루프 방지)
          if (isUpdating) return;

          // 버튼의 현재 텍스트 확인
          const buttonText = loginButton.textContent || "";
          // 이미 "로그인"이면 변경하지 않음
          if (buttonText.trim() === "로그인" || buttonText.includes("로그인")) {
            return;
          }

          // "계속"이나 "Continue"가 없으면 변경하지 않음
          if (
            !buttonText.includes("계속") &&
            !buttonText.includes("Continue")
          ) {
            return;
          }

          isUpdating = true; // 업데이트 시작 플래그
          console.log("[SignInContent] 버튼 텍스트를 '로그인'으로 변경 시도");

          // 1. cl-internal-2iusy0 클래스를 가진 span 요소를 정확히 찾아서 변경
          const continueSpan = loginButton.querySelector(
            "span.cl-internal-2iusy0",
          ) as HTMLElement;
          if (continueSpan && !continueSpan.textContent?.includes("로그인")) {
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
              (textContent.includes("계속") ||
                textContent.includes("Continue")) &&
              !textContent.includes("로그인")
            ) {
              // "로그인"이 아닌 경우만 "로그인"으로 변경
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
              (textContent.includes("계속") ||
                textContent.includes("Continue")) &&
              !textContent.includes("로그인")
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
          if (allSvgs.length > 0) {
            allSvgs.forEach((svg) => {
              svg.remove();
              console.log("[SignInContent] SVG 아이콘 제거");
            });
          }

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
                node.textContent.includes("Continue")) &&
              !node.textContent.includes("로그인")
            ) {
              node.textContent = "로그인";
              console.log(
                "[SignInContent] 텍스트 노드에서 '계속'을 '로그인'으로 변경",
              );
            }
          }

          // 6. 최종 확인: 버튼의 textContent가 "계속"을 포함하면 강제로 변경
          const finalButtonText = loginButton.textContent || "";
          if (
            (finalButtonText.includes("계속") ||
              finalButtonText.includes("Continue")) &&
            !finalButtonText.includes("로그인")
          ) {
            // 버튼의 모든 자식 요소를 제거하고 "로그인"만 추가
            loginButton.innerHTML = "로그인";
            console.log(
              "[SignInContent] 버튼 전체 내용을 '로그인'으로 강제 변경",
            );
          }

          // 다음 프레임에서 플래그 해제 (MutationObserver가 트리거되지 않도록)
          setTimeout(() => {
            isUpdating = false;
          }, 100);
        };

        // 즉시 실행
        updateButtonText();

        // MutationObserver로 버튼 내용이 변경될 때마다 다시 적용
        const buttonObserver = new MutationObserver(() => {
          // isUpdating 플래그로 무한 루프 방지
          if (!isUpdating) {
            updateButtonText();
          }
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

        // 가로채기 설정 완료 플래그
        isIntercepted = true;

        // cleanup 함수들을 배열에 저장
        cleanupFunctions.push(() => {
          clerkForm.removeEventListener("submit", handleFormSubmit, true);
          loginButton.removeEventListener("click", handleButtonClick, true);
          buttonObserver.disconnect();
        });
      } else {
        // 폼만 찾았지만 버튼은 없는 경우
        clerkForm.addEventListener("submit", handleFormSubmit, true);
        isIntercepted = true;

        // cleanup 함수를 배열에 저장
        cleanupFunctions.push(() => {
          clerkForm.removeEventListener("submit", handleFormSubmit, true);
        });
      }
    };

    // 한 번만 실행 (setInterval 제거로 무한 루프 방지)
    const initialTimeout = setTimeout(interceptClerkFormSubmit, 500);
    // 추가 확인을 위해 한 번 더 실행 (더 긴 딜레이)
    const secondTimeout = setTimeout(interceptClerkFormSubmit, 2000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
      // 저장된 cleanup 함수들 모두 실행
      cleanupFunctions.forEach((cleanup) => cleanup());
      cleanupFunctions = [];
      isIntercepted = false; // 플래그 리셋
    };
  }, [clerk, signIn, signInLoaded, router, redirectUrl, isLoaded, isSignedIn]);

  // // Clerk가 자동으로 생성한 카카오 버튼 삭제
  // useEffect(() => {
  //   const removeClerkKakaoButton = () => {
  //     // Clerk가 자동으로 생성한 카카오 버튼 찾기
  //     const clerkKakaoButton = document.querySelector(
  //       ".cl-socialButtonsIconButton__custom_kakao, button[class*='custom_kakao']",
  //     ) as HTMLElement;

  //     if (clerkKakaoButton) {
  //       console.log("[SignInContent] Clerk 자동 생성 카카오 버튼 삭제");
  //       clerkKakaoButton.remove();
  //     }
  //   };

  //   // 초기 실행 및 주기적 확인
  //   const initialTimeout = setTimeout(removeClerkKakaoButton, 500);
  //   const interval = setInterval(removeClerkKakaoButton, 1000);

  //   return () => {
  //     clearTimeout(initialTimeout);
  //     clearInterval(interval);
  //   };
  // }, []);

  // // Clerk가 자동으로 생성한 네이버 버튼 삭제
  // useEffect(() => {
  //   const removeClerkNaverButton = () => {
  //     // Clerk가 자동으로 생성한 네이버 버튼 찾기
  //     const clerkNaverButton = document.querySelector(
  //       ".cl-socialButtonsIconButton__custom_naver_auth, .cl-socialButtonsIconButton__custom_naver-auth, button[class*='custom_naver_auth'], button[class*='custom_naver-auth'], button[class*='custom_naver']",
  //     ) as HTMLElement;

  //     if (clerkNaverButton) {
  //       console.log("[SignInContent] Clerk 자동 생성 네이버 버튼 삭제");
  //       clerkNaverButton.remove();
  //     }
  //   };

  //   // 초기 실행 및 주기적 확인
  //   const initialTimeout = setTimeout(removeClerkNaverButton, 500);
  //   const interval = setInterval(removeClerkNaverButton, 1000);

  //   return () => {
  //     clearTimeout(initialTimeout);
  //     clearInterval(interval);
  //   };
  // }, []);

  // 카카오 버튼을 소셜 버튼 영역에 삽입
  useEffect(() => {
    let isInserted = false; // 삽입 완료 플래그로 무한 루프 방지

    const insertKakaoButton = () => {
      // 이미 삽입 완료되었으면 실행하지 않음
      if (isInserted) return;

      // 이메일 주소 필드 행을 찾기
      const identifierFieldRow = document.querySelector(
        ".cl-formFieldRow__identifier",
      ) as HTMLElement;
      const kakaoButton = kakaoButtonRef.current;

      if (identifierFieldRow && kakaoButton) {
        // 이미 삽입되어 있는지 확인
        const parent = kakaoButton.parentElement;
        if (
          parent &&
          parent.contains(identifierFieldRow) &&
          identifierFieldRow.previousSibling === kakaoButton
        ) {
          // 이미 올바른 위치에 있으면 플래그 설정하고 리턴
          isInserted = true;
          return;
        }

        // 기존 위치에서 제거
        if (kakaoButton.parentElement) {
          kakaoButton.parentElement.removeChild(kakaoButton);
        }

        console.log("[SignInContent] 카카오 버튼 삽입");

        // 카카오 버튼을 보이도록 설정
        kakaoButton.classList.remove("hidden");

        // 버튼이 클릭 가능하도록 스타일 강제 적용
        kakaoButton.style.cssText += `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
          z-index: 10 !important;
        `;

        // 버튼이 비활성화되지 않도록 보장
        kakaoButton.removeAttribute("disabled");
        kakaoButton.setAttribute("tabindex", "0");
        kakaoButton.setAttribute("aria-disabled", "false");

        // 이메일 필드 위에 삽입
        const formContainer = identifierFieldRow.parentElement;
        if (formContainer) {
          formContainer.insertBefore(kakaoButton, identifierFieldRow);
          isInserted = true; // 삽입 완료 플래그 설정
        }
      }
    };

    // 한 번만 실행 (setInterval 제거로 무한 루프 방지)
    const initialTimeout = setTimeout(insertKakaoButton, 500);
    // 추가 확인을 위해 한 번 더 실행 (더 긴 딜레이)
    const secondTimeout = setTimeout(insertKakaoButton, 2000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
    };
  }, []);

  // 네이버 버튼을 카카오 버튼 아래에 삽입
  useEffect(() => {
    let isInserted = false; // 삽입 완료 플래그로 무한 루프 방지

    const insertNaverButton = () => {
      // 이미 삽입 완료되었으면 실행하지 않음
      if (isInserted) return;

      const kakaoButton = kakaoButtonRef.current;
      const naverButton = naverButtonRef.current;

      if (kakaoButton && naverButton && kakaoButton.parentElement) {
        // 이미 삽입되어 있는지 확인
        const parent = naverButton.parentElement;
        if (
          parent &&
          parent === kakaoButton.parentElement &&
          kakaoButton.nextSibling === naverButton
        ) {
          // 이미 올바른 위치에 있으면 플래그 설정하고 리턴
          isInserted = true;
          return;
        }

        // 기존 위치에서 제거
        if (naverButton.parentElement) {
          naverButton.parentElement.removeChild(naverButton);
        }

        console.log("[SignInContent] 네이버 버튼을 카카오 버튼 아래에 삽입");

        // 네이버 버튼을 보이도록 설정
        naverButton.classList.remove("hidden");

        // 버튼이 클릭 가능하도록 스타일 강제 적용
        naverButton.style.cssText += `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
          z-index: 10 !important;
        `;

        // 버튼이 비활성화되지 않도록 보장
        naverButton.removeAttribute("disabled");
        naverButton.setAttribute("tabindex", "0");
        naverButton.setAttribute("aria-disabled", "false");

        // 카카오 버튼 다음에 삽입
        kakaoButton.parentElement.insertBefore(
          naverButton,
          kakaoButton.nextSibling,
        );
        isInserted = true; // 삽입 완료 플래그 설정
      }
    };

    // 한 번만 실행 (setInterval 제거로 무한 루프 방지)
    const initialTimeout = setTimeout(insertNaverButton, 600);
    // 추가 확인을 위해 한 번 더 실행 (더 긴 딜레이)
    const secondTimeout = setTimeout(insertNaverButton, 2500);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
    };
  }, []);

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
                signUpUrl="/sign-up"
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

              {/* 카카오계정 로그인 버튼 (소셜 버튼 컨테이너에 동적으로 삽입) */}
              <button
                ref={kakaoButtonRef}
                onClick={async () => {
                  console.group("[SignInContent] 카카오 로그인 버튼 클릭");
                  console.log("시간:", new Date().toISOString());
                  console.log("리다이렉트 URL:", redirectUrl);

                  try {
                    // Clerk 초기화 대기
                    if (!isLoaded || !signInLoaded) {
                      console.warn(
                        "[SignInContent] Clerk가 아직 초기화 중입니다. 잠시 후 다시 시도해주세요.",
                      );
                      alert(
                        "로그인 기능을 준비하는 중입니다. 잠시 후 다시 시도해주세요.",
                      );
                      console.groupEnd();
                      return;
                    }

                    if (!clerk || !signIn) {
                      console.error(
                        "[SignInContent] Clerk 또는 signIn이 초기화되지 않음",
                        {
                          clerk: !!clerk,
                          signIn: !!signIn,
                          isLoaded,
                          signInLoaded,
                        },
                      );
                      alert(
                        "로그인 기능을 준비하는 중입니다. 잠시 후 다시 시도해주세요.",
                      );
                      console.groupEnd();
                      return;
                    }

                    console.log("[SignInContent] 카카오 로그인 시작");
                    console.log("[SignInContent] Clerk 상태:", {
                      isLoaded,
                      signInLoaded,
                      hasClerk: !!clerk,
                      hasSignIn: !!signIn,
                    });

                    // Clerk의 authenticateWithRedirect를 사용하여 카카오 로그인
                    // Custom provider의 경우 전략 이름이 다를 수 있으므로 여러 옵션 시도
                    // 타입 오류를 피하기 위해 any 사용

                    // Clerk 대시보드에서 설정한 Custom OAuth provider 이름 확인 필요
                    // 일반적으로 "oauth_custom_{provider_name}" 형식
                    // 예: Clerk 대시보드에서 provider name을 "kakao"로 설정했다면 "oauth_custom_kakao"
                    const possibleStrategies = [
                      "oauth_custom_kakao", // Custom provider 일반적인 형식 (가장 일반적)
                      "oauth_custom_custom_kakao", // 이중 custom 접두사
                      "oauth_kakao", // Social provider 형식
                      "kakao", // 단순 형식
                    ];

                    let lastError: any = null;
                    const allErrors: string[] = [];

                    for (const strategy of possibleStrategies) {
                      try {
                        console.log(
                          `[SignInContent] 카카오 로그인 시도 - 전략: ${strategy}`,
                        );
                        await (signIn.authenticateWithRedirect as any)({
                          strategy: strategy,
                          redirectUrl: redirectUrl,
                          redirectUrlComplete: redirectUrl,
                        });
                        console.log(
                          `[SignInContent] 카카오 로그인 리다이렉트 완료 - 전략: ${strategy}`,
                        );
                        return; // 성공하면 함수 종료
                      } catch (strategyError: any) {
                        const errorMsg =
                          strategyError.message || String(strategyError);
                        console.warn(
                          `[SignInContent] 전략 ${strategy} 실패:`,
                          errorMsg,
                        );
                        allErrors.push(`${strategy}: ${errorMsg}`);
                        lastError = strategyError;
                        // 다음 전략 시도
                        continue;
                      }
                    }

                    // 모든 전략이 실패한 경우 - 더 자세한 에러 정보 제공
                    console.error(
                      "[SignInContent] 모든 카카오 로그인 전략 실패:",
                      allErrors,
                    );

                    // Clerk 대시보드 설정 확인 안내 메시지
                    const errorMessage =
                      lastError?.message ||
                      "카카오 로그인 전략을 찾을 수 없습니다.";
                    throw new Error(
                      `${errorMessage}\n\n` +
                        `가능한 원인:\n` +
                        `1. Clerk 대시보드에서 카카오 Custom OAuth provider가 설정되지 않았습니다.\n` +
                        `2. Custom OAuth provider의 이름이 코드와 일치하지 않습니다.\n` +
                        `3. 카카오 개발자 콘솔에서 OAuth 설정이 올바르지 않습니다.\n\n` +
                        `해결 방법:\n` +
                        `1. Clerk Dashboard → User & Authentication → Social Connections → Custom OAuth\n` +
                        `2. Provider name을 확인하고 코드의 전략 이름과 일치시켜주세요.\n` +
                        `3. 시도한 전략: ${possibleStrategies.join(", ")}\n\n` +
                        `에러 상세:\n${allErrors.join("\n")}`,
                    );
                  } catch (error: any) {
                    console.error("[SignInContent] 카카오 로그인 실패:", error);
                    console.error("[SignInContent] 에러 상세:", {
                      message: error.message,
                      errors: error.errors,
                      status: error.status,
                      stack: error.stack,
                    });

                    // 더 구체적인 에러 메시지
                    let errorMessage =
                      "카카오 로그인에 실패했습니다. 다시 시도해주세요.";
                    if (error.errors && error.errors.length > 0) {
                      const firstError = error.errors[0];
                      if (firstError.message) {
                        errorMessage = firstError.message;
                      }
                    } else if (error.message) {
                      errorMessage = error.message;
                    }

                    alert(errorMessage);
                  } finally {
                    console.groupEnd();
                  }
                }}
                className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-black font-semibold h-8 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md mb-4 flex items-center justify-center hidden"
                style={{
                  backgroundColor: "#FEE500",
                  height: "32px",
                }}
              >
                카카오계정 로그인
              </button>

              {/* 네이버 로그인 버튼 */}
              <button
                ref={naverButtonRef}
                onClick={async () => {
                  console.group("[SignInContent] 네이버 로그인 버튼 클릭");
                  console.log("시간:", new Date().toISOString());
                  console.log("리다이렉트 URL:", redirectUrl);

                  try {
                    if (!isLoaded || !signInLoaded) {
                      console.warn(
                        "[SignInContent] Clerk가 아직 초기화 중입니다.",
                      );
                      alert(
                        "로그인 기능을 준비하는 중입니다. 잠시 후 다시 시도해주세요.",
                      );
                      console.groupEnd();
                      return;
                    }

                    if (!clerk || !signIn) {
                      console.error(
                        "[SignInContent] Clerk 또는 signIn이 초기화되지 않음",
                      );
                      alert(
                        "로그인 기능을 준비하는 중입니다. 잠시 후 다시 시도해주세요.",
                      );
                      console.groupEnd();
                      return;
                    }

                    console.log("[SignInContent] 네이버 로그인 시작");
                    console.log("[SignInContent] Clerk 상태:", {
                      isLoaded,
                      signInLoaded,
                      hasClerk: !!clerk,
                      hasSignIn: !!signIn,
                    });

                    // OAuth 전략 시도 (Clerk 설정에 따라 형식이 다를 수 있음)
                    // Clerk 대시보드에서 설정한 Custom OAuth provider의 Key를 확인해야 함
                    // 일반적으로 "oauth_custom_{provider_key}" 형식
                    // 예: Clerk 대시보드에서 provider Key를 "naver_auth"로 설정했다면 "oauth_custom_naver_auth"
                    // ⚠️ 중요: Clerk Dashboard의 실제 Provider Key와 일치해야 함!
                    // 에러 응답에서 "supported_first_factors"를 확인하여 허용되는 전략 확인 가능
                    const possibleStrategies = [
                      "oauth_custom_naver_auth", // Key가 "naver_auth"인 경우 (현재 설정)
                      "oauth_custom_naver", // Key가 "naver"인 경우 (fallback)
                      "oauth_custom_naver-auth", // 언더스코어 대신 하이픈 (일부 경우)
                      "oauth_custom_custom_naver_auth", // 이중 custom 접두사
                      "oauth_naver_auth", // Social provider 형식
                      "naver_auth", // 단순 형식
                      "naver", // 가장 단순한 형식
                    ];

                    let lastError: any = null;
                    const allErrors: string[] = [];

                    for (const strategy of possibleStrategies) {
                      try {
                        console.log(
                          `[SignInContent] 네이버 로그인 시도 - 전략: ${strategy}`,
                        );
                        await (signIn.authenticateWithRedirect as any)({
                          strategy: strategy,
                          redirectUrl: redirectUrl,
                          redirectUrlComplete: redirectUrl,
                        });
                        console.log(
                          `[SignInContent] 네이버 로그인 리다이렉트 완료`,
                        );
                        return;
                      } catch (strategyError: any) {
                        const errorMsg =
                          strategyError.message || String(strategyError);
                        console.warn(
                          `[SignInContent] 전략 ${strategy} 실패:`,
                          errorMsg,
                        );
                        allErrors.push(`${strategy}: ${errorMsg}`);
                        lastError = strategyError;
                        continue;
                      }
                    }

                    // 모든 전략 실패
                    console.error(
                      "[SignInContent] 모든 네이버 로그인 전략 실패:",
                      allErrors,
                    );

                    // Clerk 대시보드 설정 확인 안내 메시지
                    const errorMessage =
                      lastError?.message ||
                      "네이버 로그인 전략을 찾을 수 없습니다.";
                    throw new Error(
                      `${errorMessage}\n\n` +
                        `가능한 원인:\n` +
                        `1. Clerk 대시보드에서 네이버 Custom OAuth provider가 설정되지 않았습니다.\n` +
                        `2. Custom OAuth provider의 Key가 'naver_auth'가 아닙니다.\n` +
                        `3. 네이버 개발자 콘솔에서 Callback URL이 등록되지 않았습니다.\n\n` +
                        `해결 방법:\n` +
                        `1. Clerk Dashboard → User & Authentication → Social Connections → Custom OAuth\n` +
                        `2. 네이버 provider의 Key를 확인하세요 (예: 'naver_auth', 'naver' 등)\n` +
                        `3. Key가 'naver_auth'가 아니라면 코드의 전략 이름을 수정해야 합니다.\n` +
                        `4. 시도한 전략: ${possibleStrategies.join(", ")}\n\n` +
                        `에러 상세:\n${allErrors.join("\n")}`,
                    );
                  } catch (error: any) {
                    console.error("[SignInContent] 네이버 로그인 실패:", error);
                    console.error("[SignInContent] 에러 상세:", {
                      message: error.message,
                      errors: error.errors,
                      status: error.status,
                      stack: error.stack,
                    });

                    // 에러 메시지 추출 및 개선
                    let errorMessage =
                      "네이버 로그인에 실패했습니다. 다시 시도해주세요.";
                    if (error.errors && error.errors.length > 0) {
                      const firstError = error.errors[0];
                      errorMessage = firstError.message || errorMessage;
                    } else if (error.message) {
                      errorMessage = error.message;
                    }

                    // "You did not grant access" 에러인 경우 특별 안내
                    if (
                      errorMessage.includes("did not grant access") ||
                      errorMessage.includes("grant access") ||
                      errorMessage.includes("권한을 승인")
                    ) {
                      errorMessage =
                        "네이버 로그인 권한 승인이 필요합니다.\n\n" +
                        "확인 사항:\n" +
                        "1. 네이버 개발자 센터에서 '이메일 주소'가 필수 동의로 설정되어 있는지 확인하세요.\n" +
                        "2. 네이버 로그인 페이지에서 모든 권한을 승인해주세요.\n" +
                        "3. 네이버 개발자 센터 → 내 애플리케이션 → 네이버 로그인 → 제공 정보 설정을 확인하세요.";
                    }

                    // "External Account was not found" 에러인 경우 특별 안내
                    if (
                      errorMessage.includes("External Account was not found") ||
                      errorMessage.includes("외부 계정을 찾을 수 없습니다") ||
                      errorMessage.includes("external account")
                    ) {
                      console.error(
                        "❌ [네이버 로그인 실패] External Account was not found",
                      );
                      console.error(
                        "   → Proxy 서버는 데이터를 반환했지만, Clerk가 외부 계정을 연결하지 못했습니다.",
                      );
                      console.error("   → 가능한 원인:");
                      console.error(
                        "      1. Proxy 서버 응답의 'sub' 값이 Clerk가 기대하는 형식과 다름",
                      );
                      console.error(
                        "      2. Clerk Dashboard의 Attribute Mapping에서 'sub' → 'User ID / Subject' 매핑이 잘못됨",
                      );
                      console.error(
                        "      3. 이미 같은 네이버 계정이 다른 Clerk 사용자와 연결되어 있음",
                      );
                      console.error("   → 확인 방법:");
                      console.error(
                        "      1. Proxy 서버 로그에서 'sub' 값 확인",
                      );
                      console.error(
                        "      2. Clerk Dashboard → 네이버 provider → Attribute Mapping 확인",
                      );
                      console.error(
                        "         - User ID / Subject → sub (반드시 'sub'로 매핑)",
                      );
                      console.error("         - Email → email");
                      console.error(
                        "      3. Clerk Dashboard → Users에서 해당 네이버 계정이 이미 연결되어 있는지 확인",
                      );

                      errorMessage =
                        "네이버 로그인에 실패했습니다.\n\n" +
                        "에러: External Account was not found\n\n" +
                        "가능한 원인:\n" +
                        "1. Proxy 서버 응답의 'sub' 값이 Clerk가 기대하는 형식과 다름\n" +
                        "2. Clerk Dashboard의 Attribute Mapping에서 'sub' → 'User ID / Subject' 매핑이 잘못됨\n" +
                        "3. 이미 같은 네이버 계정이 다른 Clerk 사용자와 연결되어 있음\n\n" +
                        "해결 방법:\n" +
                        "1. Proxy 서버 로그 확인 (sub 값 확인)\n" +
                        "2. Clerk Dashboard → SSO Connections → 네이버 provider → Attribute Mapping\n" +
                        "   - User ID / Subject → sub (반드시 'sub'로 매핑)\n" +
                        "   - Email → email\n" +
                        "3. Clerk Dashboard → Users에서 중복 연결 확인";
                    }

                    alert(errorMessage);
                  } finally {
                    console.groupEnd();
                  }
                }}
                className="w-full bg-[#03C75A] hover:bg-[#02b351] text-white font-semibold h-8 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md mb-4 flex items-center justify-center hidden"
                style={{
                  backgroundColor: "#03C75A",
                  height: "32px",
                }}
              >
                네이버 로그인
              </button>
            </div>

            {/* 회원가입 링크 */}
            <div className="mt-6 text-center">
              <p className="text-sm text-[#8b7d84]">
                계정이 없으신가요?{" "}
                <Link
                  href="/sign-up/join"
                  className="text-[#ff6b9d] hover:text-[#ff5088] font-semibold transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log(
                      "[SignInContent] 회원가입 페이지로 이동: /sign-up/join",
                    );
                    // window.location을 사용하여 강제로 페이지 이동 (서버 컴포넌트 리렌더링 보장)
                    window.location.href = "/sign-up/join";
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
