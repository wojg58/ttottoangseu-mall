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
import logger from "@/lib/logger-client";

export default function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const redirectUrl = searchParams.get("redirect_url") || "/";

  // 클라이언트 사이드에서만 실행 (useEffect 안으로 이동하여 hydration mismatch 방지)
  useEffect(() => {
    logger.debug("[SignInContent] 로그인 페이지 초기화", {
      redirectUrl,
      currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
    });
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
        logger.debug("[SignInContent] 최대 업데이트 횟수 도달, 업데이트 중지");
        return;
      }
      updateCount++;

      // 이미 적용된 필드는 건너뛰기
      if (isEmailFieldApplied && isPasswordFieldApplied) {
        return;
      }

      // 소셜 버튼 루트 컨테이너가 한 줄로 배치되도록 설정 (구글, 카카오, 네이버 3개 나란히)
      const socialButtonsRoot = document.querySelector(
        ".cl-socialButtonsRoot",
      ) as HTMLElement;
      if (socialButtonsRoot) {
        socialButtonsRoot.style.cssText = `
          display: flex !important;
          flex-direction: row !important;
          gap: 0.75rem !important;
          width: 100% !important;
          flex-wrap: nowrap !important;
          margin-bottom: 18.9px !important;
        `;
      }

      // 소셜 버튼 순서 변경 및 개별 컨테이너로 분리 (구글, 카카오, 네이버 순서)
      const reorderSocialButtons = () => {
        const socialButtonsRoot = document.querySelector(
          ".cl-socialButtonsRoot",
        ) as HTMLElement;
        if (!socialButtonsRoot) return;

        // 각 버튼 찾기
        const googleButton = socialButtonsRoot.querySelector(
          ".cl-socialButtonsIconButton__google",
        ) as HTMLElement;
        const kakaoButton = socialButtonsRoot.querySelector(
          ".cl-socialButtonsIconButton__custom_kakao",
        ) as HTMLElement;
        const naverButton = socialButtonsRoot.querySelector(
          ".cl-socialButtonsBlockButton__custom_naver_auth, .cl-socialButtonsIconButton__custom_naver_auth",
        ) as HTMLElement;

        if (!googleButton || !kakaoButton || !naverButton) return;

        // 기존 컨테이너 모두 제거
        const existingContainers = Array.from(
          socialButtonsRoot.querySelectorAll(".cl-socialButtons"),
        );
        existingContainers.forEach((container) => {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        });

        // 각 버튼을 개별 컨테이너로 감싸기
        const createButtonContainer = (button: HTMLElement) => {
          const container = document.createElement("div");
          container.className = "cl-socialButtons";
          container.style.cssText = `
            display: flex !important;
            width: 0 !important;
            min-width: 0 !important;
            flex: 1 1 0% !important;
            flex-shrink: 1 !important;
            flex-basis: 0 !important;
          `;
          // 버튼을 부모에서 제거하고 새 컨테이너에 추가
          if (button.parentNode) {
            button.parentNode.removeChild(button);
          }
          container.appendChild(button);
          return container;
        };

        // 순서대로 컨테이너 생성 및 추가: 구글, 카카오, 네이버
        const googleContainer = createButtonContainer(googleButton);
        const kakaoContainer = createButtonContainer(kakaoButton);
        const naverContainer = createButtonContainer(naverButton);

        socialButtonsRoot.appendChild(googleContainer);
        socialButtonsRoot.appendChild(kakaoContainer);
        socialButtonsRoot.appendChild(naverContainer);
      };

      // 각 소셜 버튼 컨테이너도 flex로 설정 (한 줄에 배치, 동일한 크기)
      const socialButtons = document.querySelectorAll(
        ".cl-socialButtons",
      ) as NodeListOf<HTMLElement>;
      socialButtons.forEach((container) => {
        // 소셜 버튼이 있는 컨테이너는 모두 표시 (구글, 카카오, 네이버 등)
        const hasAnySocialButton = container.querySelector(
          ".cl-socialButtonsBlockButton, .cl-socialButtonsIconButton",
        );
        if (hasAnySocialButton) {
          container.style.cssText = `
            display: flex !important;
            width: 0 !important;
            min-width: 0 !important;
            flex: 1 1 0% !important;
            flex-shrink: 1 !important;
            flex-basis: 0 !important;
          `;
        } else {
          // 완전히 빈 컨테이너만 숨기기
          container.style.cssText = `
            display: none !important;
          `;
        }
      });

      // 버튼 순서 변경 실행 (여러 번 시도하여 확실히 적용)
      reorderSocialButtons();

      // DOM이 완전히 로드된 후 다시 한 번 실행
      setTimeout(() => {
        reorderSocialButtons();
        updateNaverButtonText();
      }, 100);

      setTimeout(() => {
        reorderSocialButtons();
        updateNaverButtonText();
      }, 500);

      // 소셜 버튼들도 flex로 설정 (모든 버튼 동일한 높이)
      const socialButtonsBlockButton = document.querySelectorAll(
        ".cl-socialButtonsBlockButton",
      ) as NodeListOf<HTMLElement>;
      socialButtonsBlockButton.forEach((button) => {
        button.style.cssText += `
          width: 100% !important;
          min-width: 0 !important;
          height: 40px !important;
          min-height: 40px !important;
          flex: 1 !important;
        `;
      });

      const socialButtonsIconButton = document.querySelectorAll(
        ".cl-socialButtonsIconButton",
      ) as NodeListOf<HTMLElement>;
      socialButtonsIconButton.forEach((button) => {
        button.style.cssText += `
          width: 100% !important;
          min-width: 0 !important;
          height: 40px !important;
          min-height: 40px !important;
          flex: 1 !important;
        `;
      });

      // 네이버 버튼도 IconButton처럼 동작하도록 스타일 적용 (동일한 높이)
      const naverButtons = document.querySelectorAll(
        ".cl-socialButtonsBlockButton__custom_naver_auth, .cl-socialButtonsIconButton__custom_naver_auth",
      ) as NodeListOf<HTMLElement>;
      naverButtons.forEach((button) => {
        button.style.cssText += `
          width: 100% !important;
          min-width: 0 !important;
          height: 40px !important;
          min-height: 40px !important;
          flex: 1 !important;
        `;
      });

      // 네이버 버튼의 중복 텍스트 제거 (아이콘 텍스트 숨기기)
      const naverIconTexts = document.querySelectorAll(
        ".cl-socialButtonsBlockButton__custom_naver_auth .cl-internal-g5v6j2, .cl-socialButtonsIconButton__custom_naver_auth .cl-internal-g5v6j2",
      ) as NodeListOf<HTMLElement>;
      naverIconTexts.forEach((element) => {
        element.style.cssText = `display: none !important;`;
      });

      // 카카오 버튼의 "K" 글자를 "kakao"로 변경
      const updateKakaoButtonText = () => {
        const kakaoButton = document.querySelector(
          ".cl-socialButtonsIconButton__custom_kakao",
        ) as HTMLElement;
        if (kakaoButton) {
          const kakaoTextElement = kakaoButton.querySelector(
            ".cl-internal-g5v6j2",
          ) as HTMLElement;
          if (kakaoTextElement && kakaoTextElement.textContent !== "kakao") {
            kakaoTextElement.textContent = "kakao";
          }
        }
      };

      updateKakaoButtonText();

      // 카카오 버튼 텍스트가 변경되어도 "kakao"로 유지
      let lastKakaoUpdateTime = 0;
      const KAKAO_THROTTLE_MS = 1000; // 1초마다 최대 1회만 업데이트
      
      const kakaoButtonObserver = new MutationObserver(() => {
        const now = Date.now();
        if (now - lastKakaoUpdateTime > KAKAO_THROTTLE_MS) {
          lastKakaoUpdateTime = now;
          updateKakaoButtonText();
        }
      });

      const kakaoButton = document.querySelector(
        ".cl-socialButtonsIconButton__custom_kakao",
      );
      if (kakaoButton) {
        kakaoButtonObserver.observe(kakaoButton, {
          childList: true,
          subtree: false, // true에서 false로 변경 - 직접 자식만 관찰 (성능 개선)
          characterData: false, // false로 변경 - 텍스트 변경 무시 (성능 개선)
        });
      }

      // 네이버 버튼 텍스트를 "NAVER"로 변경 (이미지처럼 중앙 정렬, 중복 제거)
      const updateNaverButtonText = () => {
        // IconButton과 BlockButton 모두 처리
        const naverButton =
          (document.querySelector(
            ".cl-socialButtonsIconButton__custom_naver_auth",
          ) as HTMLElement) ||
          (document.querySelector(
            ".cl-socialButtonsBlockButton__custom_naver_auth",
          ) as HTMLElement);

        if (naverButton) {
          // 아이콘 텍스트 숨기기 (중복 제거)
          const naverIconElements = naverButton.querySelectorAll(
            ".cl-internal-g5v6j2",
          );
          naverIconElements.forEach((element) => {
            (
              element as HTMLElement
            ).style.cssText = `display: none !important;`;
          });

          // 버튼 텍스트를 "NAVER"로 강제 변경 및 중앙 정렬
          const naverButtonText = naverButton.querySelector(
            ".cl-socialButtonsBlockButtonText__custom_naver_auth, .cl-socialButtonsBlockButtonText",
          ) as HTMLElement;
          if (naverButtonText) {
            naverButtonText.textContent = "NAVER";
            naverButtonText.style.cssText = `
              color: white !important;
              font-weight: bold !important;
              font-size: 15px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: 100% !important;
              height: 100% !important;
              text-align: center !important;
              text-transform: uppercase !important;
              letter-spacing: 0.5px !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1 !important;
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -50%) !important;
            `;
          }
          
          // 버튼 자체도 중앙 정렬 강화
          naverButton.style.cssText += `
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          `;
        }
      };

      // 네이버 버튼 텍스트가 변경되어도 "NAVER"로 유지
      let lastNaverUpdateTime = 0;
      const NAVER_THROTTLE_MS = 1000; // 1초마다 최대 1회만 업데이트
      let naverObserverSetupAttempts = 0;
      const MAX_NAVER_SETUP_ATTEMPTS = 10; // 최대 10번만 시도
      
      const naverButtonObserver = new MutationObserver(() => {
        const now = Date.now();
        if (now - lastNaverUpdateTime > NAVER_THROTTLE_MS) {
          lastNaverUpdateTime = now;
          updateNaverButtonText();
        }
      });

      // 초기 실행 및 지속적인 모니터링
      updateNaverButtonText();

      // 네이버 버튼이 나타날 때까지 대기 후 Observer 설정
      const setupNaverButtonObserver = () => {
        // 최대 시도 횟수 제한
        if (naverObserverSetupAttempts >= MAX_NAVER_SETUP_ATTEMPTS) {
          logger.debug("[SignInContent] 네이버 버튼 Observer 설정 최대 시도 횟수 도달");
          return;
        }
        naverObserverSetupAttempts++;
        
        const naverButton =
          document.querySelector(
            ".cl-socialButtonsIconButton__custom_naver_auth",
          ) ||
          document.querySelector(
            ".cl-socialButtonsBlockButton__custom_naver_auth",
          );
        if (naverButton) {
          naverButtonObserver.observe(naverButton, {
            childList: true,
            subtree: false, // true에서 false로 변경 - 직접 자식만 관찰 (성능 개선)
            characterData: false, // false로 변경 - 텍스트 변경 무시 (성능 개선)
          });
        } else {
          // 버튼이 아직 없으면 잠시 후 다시 시도 (간격 증가)
          setTimeout(setupNaverButtonObserver, 500); // 100ms에서 500ms로 증가
        }
      };
      setupNaverButtonObserver();

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
            logger.debug("[SignInContent] Clerk 에러 메시지 숨김", { alertText });
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
        // 라벨 텍스트를 "이메일 주소"로 변경
        if (identifierLabel) {
          identifierLabel.textContent = "이메일 주소";

          // 기존 observer가 있으면 해제
          if (labelObserver) {
            labelObserver.disconnect();
          }

          // 라벨이 동적으로 변경되어도 "이메일 주소"로 유지
          let lastLabelUpdateTime = 0;
          const LABEL_THROTTLE_MS = 1000; // 1초마다 최대 1회만 업데이트
          
          labelObserver = new MutationObserver(() => {
            const now = Date.now();
            if (
              now - lastLabelUpdateTime > LABEL_THROTTLE_MS &&
              identifierLabel &&
              identifierLabel.textContent !== "이메일 주소"
            ) {
              lastLabelUpdateTime = now;
              identifierLabel.textContent = "이메일 주소";
            }
          });

          labelObserver.observe(identifierLabel, {
            childList: true,
            subtree: false, // true에서 false로 변경 - 직접 자식만 관찰 (성능 개선)
            characterData: false, // false로 변경 - 텍스트 변경 무시 (성능 개선)
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
        
        let lastButtonObserverUpdateTime = 0;
        const BUTTON_OBSERVER_THROTTLE_MS = 1000; // 1초마다 최대 1회만 업데이트
        
        buttonObserver = new MutationObserver(() => {
          const now = Date.now();
          if (now - lastButtonObserverUpdateTime > BUTTON_OBSERVER_THROTTLE_MS) {
            lastButtonObserverUpdateTime = now;
            updateButtonText();
          }
        });

        buttonObserver.observe(loginButton, {
          childList: true,
          subtree: false, // true에서 false로 변경 - 직접 자식만 관찰 (성능 개선)
          characterData: false, // false로 변경 - 텍스트 변경 무시 (성능 개선)
        });

        // 로그인 버튼 클릭 이벤트 로깅
        loginButton.addEventListener("click", () => {
          logger.debug("[SignInContent] 로그인 버튼 클릭", {
            buttonType: loginButton.type,
            disabled: loginButton.disabled,
          });
        });
      } else {
        logger.debug("[SignInContent] 로그인 버튼을 찾을 수 없음");
      }

      // 로그인 버튼 컨테이너에도 간격 설정 (1cm = 37.8px)
      if (loginButtonContainer) {
        logger.debug("[SignInContent] 로그인 버튼 컨테이너 간격 설정 - 1cm");
        loginButtonContainer.style.cssText = `
          margin-top: 37.8px !important;
        `;
      }
    };

    // 초기 실행 (지연 시간을 늘려 Clerk가 완전히 렌더링된 후 실행)
    const initialTimeout = setTimeout(updateForm, 500);

    // MutationObserver는 더 구체적으로 타겟팅하고, throttle 적용
    let lastUpdateTime = 0;
    const THROTTLE_MS = 3000; // 3초마다 최대 1회만 업데이트 (간격 증가)

    const observer = new MutationObserver(() => {
      const now = Date.now();
      // 추가 체크: 최대 업데이트 횟수 확인
      if (
        now - lastUpdateTime > THROTTLE_MS &&
        (!isEmailFieldApplied || !isPasswordFieldApplied) &&
        updateCount < MAX_UPDATES
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
        subtree: false, // true에서 false로 변경 - 직접 자식만 관찰 (성능 개선)
        attributes: false, // 속성 변경은 무시
        characterData: false, // 텍스트 변경 무시 (성능 개선)
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
          logger.debug("[SignInContent] Clerk 에러 메시지 숨김", { alertText });
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

    // 주기적으로 에러 메시지 확인 및 숨기기 (5초마다, 무한 루프 방지 및 성능 개선)
    const errorCheckInterval = setInterval(hideErrorAlerts, 5000);

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
      logger.debug("[SignInContent] 로그인 시도 감지", {
        redirectUrl,
      });
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
    let isRedirecting = false; // 리다이렉트 중 플래그 (무한 루프 방지)

    const preventSecondPageRedirect = () => {
      // 이미 리다이렉트 중이면 실행하지 않음 (무한 루프 방지)
      if (isRedirecting) {
        return;
      }

      const currentPath = window.location.pathname;

      // /sign-in/create, /sign-up, 또는 다른 두 번째 입력 페이지로 이동하는 것을 감지
      if (
        (currentPath.includes("/sign-in/") && currentPath !== "/sign-in") ||
        currentPath === "/sign-up" ||
        currentPath.includes("/sign-up/")
      ) {
        logger.debug("[SignInContent] 중간 페이지로 이동 감지, 즉시 홈으로 리다이렉트", { currentPath });

        // 리다이렉트 플래그 설정
        isRedirecting = true;

        // 로그인 중간 페이지로 이동하려는 시도를 즉시 홈으로 리다이렉트
        window.location.replace("/");
      }
    };

    // setInterval 제거 - 무한 루프 방지 (이벤트 리스너만 사용)
    // const interval = setInterval(preventSecondPageRedirect, 1000); // 제거

    // popstate 이벤트 리스너 (뒤로가기/앞으로가기)
    window.addEventListener("popstate", preventSecondPageRedirect);

    // pushstate/replacestate 이벤트 감지 및 차단
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const url = typeof args[2] === "string" ? args[2] : "";
      // 로그인 중간 페이지로의 이동 완전 차단
      if (
        (url.includes("/sign-in/") && url !== "/sign-in") ||
        url.includes("/sign-in/create") ||
        url.includes("/sign-in/verify")
      ) {
        logger.debug("[SignInContent] pushState 차단 (중간 페이지 방지)", { url });
        // 중간 페이지로 이동하려는 시도를 홈으로 리다이렉트
        if (window.location.pathname === "/sign-in" && !isRedirecting) {
          isRedirecting = true;
          window.location.replace("/");
        }
        return; // 두 번째 페이지로의 pushState 차단
      }
      originalPushState.apply(history, args);
      // setTimeout 제거 - 무한 루프 방지
      // setTimeout(preventSecondPageRedirect, 0); // 제거
    };

    history.replaceState = function (...args) {
      const url = typeof args[2] === "string" ? args[2] : "";
      // 로그인 중간 페이지로의 이동 완전 차단
      if (
        (url.includes("/sign-in/") && url !== "/sign-in") ||
        url.includes("/sign-in/create") ||
        url.includes("/sign-in/verify")
      ) {
        logger.debug("[SignInContent] replaceState 차단 (중간 페이지 방지)", { url });
        // 중간 페이지로 이동하려는 시도를 홈으로 리다이렉트
        if (window.location.pathname === "/sign-in" && !isRedirecting) {
          isRedirecting = true;
          window.location.replace("/");
        }
        return; // 두 번째 페이지로의 replaceState 차단
      }
      originalReplaceState.apply(history, args);
      // setTimeout 제거 - 무한 루프 방지
      // setTimeout(preventSecondPageRedirect, 0); // 제거
    };

    return () => {
      // clearInterval(interval); // 제거
      window.removeEventListener("popstate", preventSecondPageRedirect);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [router]);

  // Clerk 폼 제출을 가로채서 바로 로그인 처리
  // useRef를 사용하여 의존성 변경으로 인한 무한 루프 방지
  const isInterceptedRef = useRef(false);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);
  
  useEffect(() => {
    // 이미 가로채기 설정되었으면 실행하지 않음 (무한 루프 방지)
    if (isInterceptedRef.current) {
      return;
    }
    
    // Clerk가 아직 초기화되지 않았으면 실행하지 않음
    if (!isLoaded || !signInLoaded || !signIn || !clerk) {
      return;
    }
    
    const cleanupFunctions: (() => void)[] = []; // cleanup 함수들을 저장

    const interceptClerkFormSubmit = () => {
      // 이미 설정되었으면 실행하지 않음 (중복 방지)
      if (isInterceptedRef.current) return;

      const clerkForm = document.querySelector(
        "form.cl-form",
      ) as HTMLFormElement;
      if (!clerkForm) return;

      // 폼 제출 이벤트 가로채기
      const handleFormSubmit = async (e: SubmitEvent) => {
        logger.debug("[SignInContent] Clerk 폼 제출 가로채기 - 바로 로그인 처리", {
          eventType: e.type,
        });

        // 기본 동작 완전히 방지 (Clerk의 기본 리다이렉트 막기)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // 추가로 모든 이벤트 전파 차단
        if (e.cancelable) {
          e.preventDefault();
        }

        // Clerk의 기본 폼 제출 동작 완전히 차단
        const form = e.target as HTMLFormElement;
        if (form) {
          form.action = "javascript:void(0)";
          form.method = "get";
        }

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

          logger.debug("[SignInContent] 입력값 확인", {
            hasInput: !!identifierInput,
            hasValue: !!identifierInput?.value,
            emailLength: emailValue.length,
            hasPassword: !!passwordValue,
            passwordLength: passwordValue ? passwordValue.length : 0,
          });

          // 이메일 형식 검증
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailValue && !emailRegex.test(emailValue)) {
            logger.error("[SignInContent] 이메일 형식이 올바르지 않음", {
              email: emailValue,
            });
            alert(
              "올바른 이메일 주소 형식을 입력해주세요.\n예: example@email.com",
            );
            return;
          }

          // 빈 값 체크
          if (!emailValue || emailValue.length === 0) {
            logger.warn("[SignInContent] 이메일 값이 비어있음");
            alert("이메일 주소를 입력해주세요.");
            return;
          }

          if (!passwordValue || passwordValue.length === 0) {
            logger.warn("[SignInContent] 비밀번호 값이 비어있음");
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

          logger.debug("[SignInContent] 최종 검증된 이메일 확인", {
            hasEmail: !!emailValue,
            emailLength: emailValue.length,
          });

          if (emailValue && passwordValue) {
            try {

              // Clerk가 초기화될 때까지 대기 (Promise 기반, 최대 5초)
              const waitForClerkInit = (): Promise<boolean> => {
                return new Promise((resolve) => {
                  const maxWaitTime = 5000; // 5초
                  const checkInterval = 100; // 100ms마다 확인
                  const startTime = Date.now();
                  let intervalId: NodeJS.Timeout | null = null;

                  const checkInit = () => {
                    // 매번 최신 상태를 확인 (클로저 문제 해결)
                    const currentIsLoaded = isLoaded;
                    const currentSignInLoaded = signInLoaded;
                    const hasSignIn = signIn !== null && signIn !== undefined;
                    const hasSetActive =
                      clerk && typeof clerk.setActive === "function";

                    const elapsed = Date.now() - startTime;

                    // 초기화 완료 확인
                    if (
                      currentIsLoaded &&
                      currentSignInLoaded &&
                      hasSignIn &&
                      hasSetActive
                    ) {
                      if (intervalId) {
                        clearInterval(intervalId);
                      }
                      logger.debug("[SignInContent] Clerk 초기화 확인 완료");
                      resolve(true);
                      return;
                    }

                    // 타임아웃 체크
                    if (elapsed >= maxWaitTime) {
                      if (intervalId) {
                        clearInterval(intervalId);
                      }
                      logger.warn("[SignInContent] Clerk 초기화 타임아웃", {
                        elapsed,
                        isLoaded: currentIsLoaded,
                        signInLoaded: currentSignInLoaded,
                        hasSignIn,
                        hasSetActive,
                      });
                      resolve(false);
                      return;
                    }

                    // 주기적으로 상태 로그 출력
                    if (elapsed > 0 && elapsed % 1000 === 0) {
                      logger.debug(`[SignInContent] 초기화 대기 중... (${elapsed}ms)`);
                    }
                  };

                  // 즉시 한 번 확인
                  checkInit();

                  // 주기적으로 확인
                  intervalId = setInterval(checkInit, checkInterval);
                });
              };

              const isInitialized = await waitForClerkInit();

              // 최종 확인
              if (
                !isInitialized ||
                !isLoaded ||
                !signInLoaded ||
                !signIn ||
                !clerk?.setActive
              ) {
                logger.error("[SignInContent] Clerk가 초기화되지 않음 (타임아웃)", {
                  isLoaded,
                  signInLoaded,
                  hasSignIn: !!signIn,
                  hasSetActive: !!clerk?.setActive,
                });

                // 페이지 새로고침 제안
                const shouldReload = confirm(
                  "로그인 시스템을 준비하는 중입니다. 페이지를 새로고침하시겠습니까?",
                );
                if (shouldReload) {
                  window.location.reload();
                }
                return;
              }

              logger.debug(
                "[SignInContent] Clerk 초기화 확인 완료, 로그인 시작",
              );

              // 이메일과 비밀번호를 함께 전달하여 로그인 시도
              logger.debug("[SignInContent] SignIn.create 호출 중", {
                hasIdentifier: !!emailValue,
                identifierType: typeof emailValue,
                identifierLength: emailValue.length,
                hasPassword: !!passwordValue,
              });

              // 최종 검증: 이메일 형식 재확인
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(emailValue)) {
                logger.warn("[SignInContent] 최종 검증 실패 - 이메일 형식이 올바르지 않음");
                alert(
                  "올바른 이메일 주소 형식을 입력해주세요.\n예: example@email.com",
                );
                return;
              }

              // Clerk 로그인: 두 단계 방식으로 처리
              // 1단계: identifier만으로 signIn 생성
              // 2단계: password로 인증 시도
              let signInAttempt;
              let result;

              try {
                // 1단계: identifier만으로 signIn 생성
                logger.debug("[SignInContent] identifier 값 확인", {
                  hasValue: !!emailValue,
                  type: typeof emailValue,
                  length: emailValue.length,
                });

                signInAttempt = await signIn.create({
                  identifier: emailValue,
                });

                logger.debug("[SignInContent] SignIn.create 성공", {
                  status: signInAttempt.status,
                });

                // 2단계: 비밀번호로 인증 시도
                logger.debug("[SignInContent] 2단계: 비밀번호로 인증 시도");
                logger.debug("[SignInContent] attemptFirstFactor 호출 중", {
                  isProduction: window.location.hostname !== "localhost",
                  hostname: window.location.hostname,
                  protocol: window.location.protocol,
                  href: window.location.href,
                });

                result = await signInAttempt.attemptFirstFactor({
                  strategy: "password",
                  password: passwordValue,
                });

                logger.debug("[SignInContent] attemptFirstFactor 성공", {
                  status: result.status,
                });
              } catch (error: any) {
                // 에러 상세 로깅
                logger.error("[SignInContent] 로그인 과정에서 에러 발생", {
                  errorType: typeof error,
                  errorName: error?.name,
                  errorMessage: error?.message,
                  errorCode: error?.errors?.[0]?.code,
                });

                // 에러를 다시 throw하여 상위 catch 블록에서 처리
                throw error;
              }

              logger.debug("[SignInContent] 로그인 성공", {
                status: result.status,
                hasCreatedSessionId: !!result.createdSessionId,
              });

              // 로그인 성공 후 세션 활성화 및 리다이렉트
              if (result.status === "complete") {
                logger.debug("[SignInContent] 로그인 완료, 세션 활성화 시작", {
                  hasCreatedSessionId: !!result.createdSessionId,
                  hasSetActive: !!clerk?.setActive,
                });

                // 세션 활성화
                if (result.createdSessionId && clerk.setActive) {
                  try {
                    logger.debug("[SignInContent] setActive 호출 중");

                    // 프로덕션 환경에서 세션 활성화 재시도 로직
                    let setActiveSuccess = false;
                    let lastError: any = null;

                    for (let attempt = 1; attempt <= 3; attempt++) {
                      try {
                        logger.debug(`[SignInContent] setActive 시도 ${attempt}/3`);
                        await clerk.setActive({
                          session: result.createdSessionId,
                        });
                        setActiveSuccess = true;
                        logger.debug("[SignInContent] setActive 완료");

                        // setActive 직후 즉시 홈으로 리다이렉트하여 중간 페이지 방지
                        window.location.replace("/");
                        return; // 즉시 함수 종료하여 추가 처리 방지
                      } catch (retryError: any) {
                        lastError = retryError;
                        logger.warn(`[SignInContent] setActive 시도 ${attempt} 실패`, retryError);

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

                    // setActive 후 즉시 홈으로 리다이렉트 (딜레이 제거하여 중간 페이지 방지)
                    // 로그인 성공 시 즉시 홈으로 이동 (중간 페이지 방지)
                    const homePath = `${window.location.origin}/`;

                    // 즉시 홈으로 리다이렉트하여 중간 페이지로 이동하는 것을 방지
                    // window.location.replace를 사용하여 히스토리에 남기지 않음
                    window.location.replace(homePath);
                  } catch (setActiveError: any) {
                    logger.error("[SignInContent] setActive 실패", {
                      message: setActiveError.message,
                      errorCode: setActiveError.errors?.[0]?.code,
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

                    // 프로덕션에서는 홈으로 리다이렉트를 시도하고, 실패하면 새로고침
                    if (isProduction) {
                      try {
                        window.location.href = "/";
                        // 리다이렉트가 실패하면 새로고침
                        setTimeout(() => {
                          window.location.reload();
                        }, 2000);
                      } catch {
                        window.location.reload();
                      }
                    } else {
                      window.location.href = "/";
                    }
                    return;
                  }
                } else {
                  logger.warn("[SignInContent] createdSessionId 또는 setActive가 없음", {
                    hasCreatedSessionId: !!result.createdSessionId,
                    hasSetActive: !!clerk?.setActive,
                  });

                  // createdSessionId가 없으면 홈으로 이동
                  window.location.href = "/";
                }
              } else {
                logger.warn("[SignInContent] 로그인 상태가 complete가 아님", {
                  status: result.status,
                });

                // 상태별 안내 메시지
                let errorMessage =
                  "로그인을 완료할 수 없습니다. 다시 시도해주세요.";

                if (result.status === "needs_new_password") {
                  errorMessage = "비밀번호를 재설정해야 합니다.";
                  alert(errorMessage);
                } else if (result.status === "needs_second_factor") {
                  // 2단계 인증이 필요한 경우 (새로운 클라이언트/기기에서 로그인 시)
                  logger.debug("[SignInContent] 2단계 인증 필요, 자동 처리 시작", {
                    hasSupportedSecondFactors: !!result.supportedSecondFactors,
                    supportedSecondFactorsCount: result.supportedSecondFactors?.length || 0,
                    clientTrustState: result.clientTrustState,
                  });

                  try {
                    // 이메일 링크를 우선적으로 사용 (사용자가 링크를 클릭하면 자동으로 로그인됨)
                    const emailLinkStrategy =
                      result.supportedSecondFactors?.find(
                        (factor: any) => factor.strategy === "email_link",
                      );

                    if (emailLinkStrategy) {
                      logger.debug("[SignInContent] 이메일 링크 전송 시작");

                      // 이메일 링크 전송 (링크를 클릭하면 자동으로 로그인됨)
                      await signInAttempt.prepareSecondFactor({
                        strategy: "email_link",
                        redirectUrl: redirectUrl.startsWith("http")
                          ? redirectUrl
                          : `${window.location.origin}${redirectUrl}`,
                      });

                      logger.debug("[SignInContent] 이메일 링크 전송 완료");

                      // 사용자에게 안내 메시지 표시
                      alert(
                        "보안을 위해 이메일 인증이 필요합니다.\n\n" +
                          "이메일로 인증 링크를 보냈습니다.\n" +
                          "이메일을 확인하고 링크를 클릭해주세요.\n\n" +
                          "인증 링크를 클릭하면 자동으로 로그인됩니다.",
                      );
                      return;
                    }

                    // 이메일 링크가 없으면 이메일 코드 사용
                    const emailCodeStrategy =
                      result.supportedSecondFactors?.find(
                        (factor: any) => factor.strategy === "email_code",
                      );

                    if (emailCodeStrategy) {
                      logger.debug("[SignInContent] 이메일 코드 전송 시작");
                      // 2단계 인증 코드 전송
                      await signInAttempt.prepareSecondFactor({
                        strategy: "email_code",
                      });

                      logger.debug("[SignInContent] 이메일 코드 전송 완료, UI 자동 표시");
                      // 이메일 코드 입력 UI가 자동으로 표시됨 (Clerk가 처리)
                      // 사용자가 코드를 입력하면 자동으로 인증 완료됨
                      return;
                    } else {
                      // 지원되는 2단계 인증 방법이 없는 경우
                      logger.warn("[SignInContent] 지원되는 2단계 인증 방법을 찾을 수 없음");
                      errorMessage =
                        "2단계 인증이 필요하지만 지원되는 방법을 찾을 수 없습니다.\n\n" +
                        "Clerk Dashboard에서 이메일 인증 설정을 확인해주세요.";
                      alert(errorMessage);
                    }
                  } catch (mfaError: any) {
                    logger.error("[SignInContent] 2단계 인증 처리 중 에러", {
                      message: mfaError.message,
                      errorCode: mfaError.errors?.[0]?.code,
                      status: mfaError.status,
                    });
                    errorMessage =
                      "2단계 인증 처리 중 오류가 발생했습니다.\n\n" +
                      "에러: " +
                      (mfaError.errors?.[0]?.message ||
                        mfaError.message ||
                        "알 수 없는 오류") +
                      "\n\n다시 시도해주세요.";
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
              const errorCode = err.errors?.[0]?.code;

              logger.error("[SignInContent] 로그인 실패", {
                errorCode,
                errorMessage: err.message,
                errorName: err.name,
                status: err.status,
                statusCode: err.statusCode,
                isProduction,
              });

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

          // 1. cl-internal-2iusy0 클래스를 가진 span 요소를 정확히 찾아서 변경
          const continueSpan = loginButton.querySelector(
            "span.cl-internal-2iusy0",
          ) as HTMLElement;
          if (continueSpan && !continueSpan.textContent?.includes("로그인")) {
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
              (textContent.includes("계속") ||
                textContent.includes("Continue")) &&
              !textContent.includes("로그인")
            ) {
              // "로그인"이 아닌 경우만 "로그인"으로 변경
              spanElement.innerHTML = "로그인";
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
            }
          });

          // 4. 버튼 내의 모든 SVG 아이콘 제거 (화살표 아이콘 등)
          const allSvgs = loginButton.querySelectorAll("svg");
          if (allSvgs.length > 0) {
            allSvgs.forEach((svg) => {
              svg.remove();
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
          }

          // 다음 프레임에서 플래그 해제 (MutationObserver가 트리거되지 않도록)
          setTimeout(() => {
            isUpdating = false;
          }, 100);
        };

        // 즉시 실행
        updateButtonText();

        // MutationObserver로 버튼 내용이 변경될 때마다 다시 적용
        let lastButtonUpdateTime = 0;
        const BUTTON_THROTTLE_MS = 1000; // 1초마다 최대 1회만 업데이트
        
        const buttonObserver = new MutationObserver(() => {
          // isUpdating 플래그와 throttle로 무한 루프 방지
          const now = Date.now();
          if (!isUpdating && now - lastButtonUpdateTime > BUTTON_THROTTLE_MS) {
            lastButtonUpdateTime = now;
            updateButtonText();
          }
        });

        buttonObserver.observe(loginButton, {
          childList: true,
          subtree: false, // true에서 false로 변경 - 직접 자식만 관찰 (성능 개선)
          characterData: false, // false로 변경 - 텍스트 변경 무시 (성능 개선)
        });

        // 버튼 클릭 이벤트도 가로채기 (폼 제출과 동일한 처리)
        const handleButtonClick = async (e: MouseEvent) => {
          logger.debug("[SignInContent] 로그인 버튼 클릭 감지");
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
        isInterceptedRef.current = true;

        // cleanup 함수들을 배열에 저장
        cleanupFunctions.push(() => {
          clerkForm.removeEventListener("submit", handleFormSubmit, true);
          loginButton.removeEventListener("click", handleButtonClick, true);
          buttonObserver.disconnect();
        });
      } else {
        // 폼만 찾았지만 버튼은 없는 경우
        clerkForm.addEventListener("submit", handleFormSubmit, true);
        isInterceptedRef.current = true;

        // cleanup 함수를 배열에 저장
        cleanupFunctions.push(() => {
          clerkForm.removeEventListener("submit", handleFormSubmit, true);
        });
      }
    };

    // cleanup 함수들을 ref에 저장
    cleanupFunctionsRef.current = cleanupFunctions;

    // 한 번만 실행 (setInterval 제거로 무한 루프 방지)
    const initialTimeout = setTimeout(interceptClerkFormSubmit, 500);
    // 추가 확인을 위해 한 번 더 실행 (더 긴 딜레이)
    const secondTimeout = setTimeout(interceptClerkFormSubmit, 2000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(secondTimeout);
      // 저장된 cleanup 함수들 모두 실행
      cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
      cleanupFunctionsRef.current = [];
      isInterceptedRef.current = false; // 플래그 리셋
    };
    // clerk, signIn, redirectUrl은 초기화 후 변경되지 않으며,
    // isInterceptedRef로 무한 루프를 방지하므로 의존성 배열에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, signInLoaded]);

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

  // 로그인 성공 후 홈으로 리다이렉트 처리
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      logger.debug("[SignInContent] 로그인 성공 감지, 홈으로 이동", {
        isSignedIn,
        isLoaded,
      });

      // 항상 홈으로 리다이렉트 (약간의 딜레이를 두어 사용자 동기화가 완료될 시간을 줌)
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } else if (isLoaded && !isSignedIn) {
      // 로그인 페이지에 있는데 isSignedIn이 false인 경우 로그만 출력
      logger.debug("[SignInContent] isLoaded는 true이지만 isSignedIn이 false입니다.");
    }
  }, [isLoaded, isSignedIn, router]);

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
                logger.debug("[SignInContent] 홈으로 이동");
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
                afterSignInUrl="/"
                fallbackRedirectUrl="/"
                forceRedirectUrl="/"
                redirectUrl="/"
                // Clerk의 기본 리다이렉트 동작 완전히 비활성화
                unsafeMetadata={{}}
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
                    e.preventDefault();
                    logger.debug("[SignInContent] 회원가입 페이지로 이동: /sign-up/join");
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
