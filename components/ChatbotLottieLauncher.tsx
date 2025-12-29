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
      {animationData ? <Lottie animationData={animationData} loop autoplay /> : null}
    </button>
  );
}
