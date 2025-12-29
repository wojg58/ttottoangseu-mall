"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { openChatWidget } from "@/lib/chat-widget-utils";

export default function ChatbotLottieLauncher() {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    fetch("/lottie/chatbot-button.json")
      .then((r) => r.json())
      .then(setAnimationData)
      .catch(console.error);
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
        background: "transparent",
        cursor: "pointer",
        zIndex: 99999,
      }}
    >
      {animationData ? (
        <Lottie animationData={animationData} loop autoplay />
      ) : null}
    </button>
  );
}
