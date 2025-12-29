"use client";

import { useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";

export default function ChatbotLottieLauncher() {
  const [animationData, setAnimationData] = useState<any>(null);

  // ✅ 런처 element를 캐시
  const launcherElRef = useRef<HTMLElement | null>(null);
  const triedRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/lottie/chatbot-button.json")
      .then((r) => r.json())
      .then(setAnimationData)
      .catch(console.error);
  }, []);

  // ✅ 런처 찾기: 최대 N번만, 찾으면 중지
  useEffect(() => {
    const selectors = [
      "#chatbot-launcher",
      ".chatbot-launcher",
      ".chat-widget-launcher",
      "[data-chatbot-launcher]",
      // 필요하면 여기 추가
    ];

    const MAX_TRIES = 20; // 20번(=약 10초) 정도면 충분
    const INTERVAL_MS = 500;

    const findLauncherOnce = () => {
      triedRef.current += 1;

      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          launcherElRef.current = el;
          console.log("✅ 기존 런처 버튼 찾음:", sel, el);
          stop();
          return;
        }
      }

      if (triedRef.current === 1) {
        console.log("🔎 기존 런처 버튼 찾는 중...");
      }

      if (triedRef.current >= MAX_TRIES) {
        console.log("❌ 기존 런처 버튼을 못 찾았습니다. 탐색 종료");
        stop();
      }
    };

    const stop = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // 이미 찾았다면 다시 안 돌림
    if (launcherElRef.current) return;

    // interval 시작
    intervalRef.current = window.setInterval(findLauncherOnce, INTERVAL_MS);
    // 즉시 1회 실행
    findLauncherOnce();

    // 언마운트 시 정리
    return () => stop();
  }, []);

  const openChat = () => {
    // ✅ 1) 캐시된 런처가 있으면 click으로 열기
    if (launcherElRef.current) {
      launcherElRef.current.click();
      return;
    }

    // ✅ 2) 마지막 1회만 다시 찾고 시도
    console.log("🔁 런처 재탐색 후 열기 시도");
    const el =
      (document.querySelector("#chatbot-launcher") as HTMLElement | null) ||
      (document.querySelector("[data-chatbot-launcher]") as HTMLElement | null);

    if (el) {
      launcherElRef.current = el;
      el.click();
      return;
    }

    console.log("❌ 런처가 아직 없습니다. (페이지 로드 후 다시 시도)");
  };

  return (
    <button
      type="button"
      aria-label="상담 열기"
      onClick={openChat}
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
