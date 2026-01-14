"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { openChatWidget } from "@/lib/chat-widget-utils";
import logger from "@/lib/logger-client";

export default function ChatbotLottieLauncher() {
  const [animationData, setAnimationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnimation = async () => {
      setIsLoading(true);
      
      // 여러 경로를 시도하여 파일 로드 (404 에러 방지)
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const paths = [
        "/lottie/chatbot-button.json", // 상대 경로 (기본)
        `${baseUrl}/lottie/chatbot-button.json`, // 절대 경로
      ];

      for (const path of paths) {
        try {
          logger.debug("[ChatbotLottieLauncher] 애니메이션 로드 시도", { path });
          
          const response = await fetch(path, {
            cache: "force-cache", // 캐시 사용으로 성능 개선
          });

          if (response.ok) {
            const data = await response.json();
            if (data && typeof data === "object" && data.v && data.fr) {
              // Lottie JSON 형식 검증 (v: version, fr: frameRate 필수)
              setAnimationData(data);
              logger.debug("[ChatbotLottieLauncher] ✅ 애니메이션 데이터 로드 성공", { path });
              setIsLoading(false);
              return; // 성공하면 종료
            } else {
              throw new Error("Invalid Lottie animation format");
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          logger.debug("[ChatbotLottieLauncher] 경로 시도 실패", {
            path,
            error: error instanceof Error ? error.message : String(error),
          });
          continue; // 다음 경로 시도
        }
      }

      // 모든 경로 실패
      logger.debug("[ChatbotLottieLauncher] ⚠️ 모든 경로에서 애니메이션 데이터 로드 실패");
      logger.debug("[ChatbotLottieLauncher] 버튼은 표시되지만 애니메이션 없이 작동합니다");
      setIsLoading(false);
      // animationData는 null로 유지되어 버튼은 표시되지만 애니메이션 없이 작동
    };

    loadAnimation();
  }, []);

  // 기존 런처 버튼 숨기기 (opacity:0 + pointer-events:none)
  useEffect(() => {
    const hideExistingLaunchers = () => {
      const selectors = [
        "#chatbot-launcher",
        ".chatbot-launcher",
        ".chat-widget-launcher",
        "[data-chatbot-launcher]",
        "#channelio-launcher",
        ".channelio-launcher",
        "[data-channelio-id]",
        'button[aria-label*="또또앙스 챗봇"]',
        'button[aria-label*="상담"]',
      ];

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          // Lottie 버튼 자체는 제외
          if (htmlEl.getAttribute("aria-label") === "상담 열기") {
            return;
          }
          htmlEl.style.opacity = "0";
          htmlEl.style.pointerEvents = "none";
        });
      });
    };

    // DOM이 로드된 후 실행
    if (document.readyState === "complete") {
      setTimeout(hideExistingLaunchers, 500);
    } else {
      window.addEventListener("load", () => {
        setTimeout(hideExistingLaunchers, 500);
      });
    }

    // MutationObserver로 동적으로 추가되는 요소도 처리
    const observer = new MutationObserver(() => {
      hideExistingLaunchers();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleClick = () => {
    openChatWidget();
  };

  return (
    <button
      type="button"
      aria-label="상담 열기"
      onClick={handleClick}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 72,
        height: 72,
        borderRadius: 9999,
        border: "none",
        background: isLoading || !animationData ? "rgba(255, 107, 157, 0.9)" : "transparent",
        cursor: "pointer",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
      }}
    >
      {isLoading ? (
        <span style={{ color: "white", fontSize: "24px" }}>💬</span>
      ) : animationData ? (
        <Lottie animationData={animationData} loop autoplay />
      ) : (
        <span style={{ color: "white", fontSize: "24px" }}>💬</span>
      )}
    </button>
  );
}
