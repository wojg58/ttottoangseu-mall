"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

export default function ChatbotLottieLauncher() {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    fetch("/lottie/chatbot-button.json")
      .then((r) => r.json())
      .then(setAnimationData)
      .catch(console.error);
  }, []);

  // 위젯 감지 로그 (개발 환경에서 확인용)
  useEffect(() => {
    console.group("[ChatbotLottieLauncher] 위젯 감지 상태");
    console.log("ChannelIO:", !!(window as any).ChannelIO);
    console.log("Crisp:", !!(window as any).$crisp);
    console.log("Tawk_API:", !!(window as any).Tawk_API);
    console.log("Intercom:", !!(window as any).Intercom);
    console.log("ChatWidget:", !!(window as any).ChatWidget);
    console.groupEnd();
  }, []);

  // 기존 상담 위젯 런처 버튼 자동 찾기 및 숨기기
  useEffect(() => {
    const findAndHideLaunchers = () => {
      // 화면에 떠 있는 고정(fixed) 버튼/위젯 후보를 찾기
      const els = [...document.querySelectorAll("body *")].filter((el) => {
        const s = getComputedStyle(el);
        if (s.position !== "fixed") return false;

        const r = el.getBoundingClientRect();
        
        // 너무 작은 요소 제외
        if (r.width < 30 || r.height < 30) return false;
        
        // 너무 큰 요소 제외 (배경 이미지 등) - 화면의 50% 이상이면 제외
        if (r.width > window.innerWidth * 0.5 || r.height > window.innerHeight * 0.5) {
          return false;
        }

        // 우하단 근처에 있는 것만
        const nearBottomRight =
          r.right > window.innerWidth - 220 &&
          r.bottom > window.innerHeight - 220;

        return nearBottomRight;
      });

      console.group("[ChatbotLottieLauncher] 기존 런처 버튼 찾기");
      console.log("우하단 fixed 후보 개수:", els.length);

      // Lottie 버튼 자체는 제외
      const lottieButton = document.querySelector(
        '[aria-label="상담 챗봇 열기"]',
      );
      
      // 배경 이미지 요소 제외 (inset-0 또는 전체 화면을 덮는 요소)
      const filteredEls = els.filter((el) => {
        if (el === lottieButton) return false;
        
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        
        // 배경 이미지로 보이는 요소 제외
        // - z-index가 음수이거나 매우 낮음
        // - 또는 inset-0 스타일을 가진 요소
        const zIndex = parseInt(s.zIndex);
        if (zIndex < 0 || s.zIndex === "-10") return false;
        
        // img 태그나 배경 이미지를 포함하는 요소 제외
        if (el.tagName === "IMG" || el.querySelector("img[fill]")) return false;
        
        return true;
      });

      filteredEls.slice(0, 10).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const id = el.id ? `#${el.id}` : "";
        const className = el.className
          ? `.${String(el.className).replaceAll(" ", ".")}`
          : "";

        console.log(
          `${i + 1}.`,
          el.tagName,
          id,
          className,
          `(${Math.round(r.width)}x${Math.round(r.height)})`,
          el,
        );

        // 기존 런처 버튼 숨기기
        (el as HTMLElement).style.display = "none";
        (el as HTMLElement).style.visibility = "hidden";
        (el as HTMLElement).style.opacity = "0";
        (el as HTMLElement).style.pointerEvents = "none";
      });

      console.log(`✅ ${filteredEls.length}개의 기존 런처 버튼을 숨겼습니다.`);
      console.groupEnd();
    };

    // DOM이 로드된 후 실행
    if (document.readyState === "complete") {
      // 약간의 지연을 두어 다른 스크립트가 먼저 실행되도록
      setTimeout(findAndHideLaunchers, 1000);
    } else {
      window.addEventListener("load", () => {
        setTimeout(findAndHideLaunchers, 1000);
      });
    }

    // 주기적으로 체크 (동적으로 추가되는 위젯 대응)
    const interval = setInterval(findAndHideLaunchers, 3000);

    return () => clearInterval(interval);
  }, []);

  const openChatWidget = () => {
    console.group("[ChatbotLottieLauncher] 상담창 열기 시도");

    // ✅ 1) ChannelIO(채널톡)
    if ((window as any).ChannelIO) {
      console.log("✅ ChannelIO 감지됨 - 상담창 열기");
      (window as any).ChannelIO("show");
      (window as any).ChannelIO("openChat");
      console.groupEnd();
      return;
    }

    // ✅ 2) Crisp
    if ((window as any).$crisp) {
      console.log("✅ Crisp 감지됨 - 상담창 열기");
      (window as any).$crisp.push(["do", "chat:open"]);
      console.groupEnd();
      return;
    }

    // ✅ 3) Tawk.to
    if ((window as any).Tawk_API) {
      console.log("✅ Tawk_API 감지됨 - 상담창 열기");
      (window as any).Tawk_API.maximize();
      console.groupEnd();
      return;
    }

    // ✅ 4) Intercom
    if ((window as any).Intercom) {
      console.log("✅ Intercom 감지됨 - 상담창 열기");
      (window as any).Intercom("show");
      console.groupEnd();
      return;
    }

    // ✅ 5) 자체 위젯일 경우 (예: window.ChatWidget.open())
    if ((window as any).ChatWidget?.open) {
      console.log("✅ ChatWidget 감지됨 - 상담창 열기");
      (window as any).ChatWidget.open();
      console.groupEnd();
      return;
    }

    console.warn("❌ 설치된 상담 위젯이 없습니다.");
    console.groupEnd();
    alert("상담 위젯이 아직 로드되지 않았어요. 잠시 후 다시 눌러주세요!");
  };

  return (
    <button
      type="button"
      aria-label="상담 챗봇 열기"
      onClick={openChatWidget}
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
