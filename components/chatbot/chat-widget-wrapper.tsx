/**
 * @file components/chatbot/chat-widget-wrapper.tsx
 * @description ChatWidget를 클라이언트에서만 로드하기 위한 래퍼 컴포넌트
 * 
 * Server Component에서 ssr: false를 사용할 수 없으므로,
 * 클라이언트 컴포넌트로 래핑하여 동적 import를 처리합니다.
 */

"use client";

import dynamic from "next/dynamic";

// ChatWidget를 동적 import하여 클라이언트에서만 로드 (hydration 에러 방지)
const ChatWidget = dynamic(
  () => import("./chat-widget").then((mod) => ({ default: mod.ChatWidget })),
  {
    ssr: false,
  }
);

export default function ChatWidgetWrapper() {
  return <ChatWidget />;
}

