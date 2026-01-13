/**
 * @file components/kakao-channel-button.tsx
 * @description 카카오톡 채널 친구추가 버튼 컴포넌트
 *
 * 이 컴포넌트는 카카오톡 채널 친구추가 버튼을 제공합니다.
 * 환경변수로 채널 URL 또는 ID를 관리하며, 클릭 시 새 탭에서 카카오톡 채널을 엽니다.
 *
 * 주요 기능:
 * 1. 환경변수 기반 채널 링크 생성 (KAKAO_CHANNEL_URL 우선, 없으면 KAKAO_CHANNEL_ID 사용)
 * 2. 새 탭으로 열기 (target="_blank", rel="noopener noreferrer")
 * 3. 카카오 느낌의 디자인 (노란색 계열 + 말풍선 아이콘)
 * 4. 반응형 디자인 지원
 *
 * @dependencies
 * - lucide-react: 말풍선 아이콘 (MessageCircle)
 * - next/link: 링크 처리
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KakaoChannelButtonProps {
  /**
   * 버튼 크기 변형
   * - default: 기본 크기
   * - sm: 작은 크기
   * - lg: 큰 크기
   */
  variant?: "default" | "sm" | "lg";
  /**
   * 전체 너비 사용 여부
   */
  fullWidth?: boolean;
  /**
   * 위치 태그 (로깅용, 선택사항)
   */
  locationTag?: string;
  /**
   * 버튼 상단 안내 문구
   */
  description?: string;
  /**
   * 버튼 텍스트 (기본값: "카카오톡 채널 추가")
   */
  buttonText?: string;
}

/**
 * 카카오톡 채널 URL 생성 함수
 * KAKAO_CHANNEL_URL이 있으면 우선 사용, 없으면 KAKAO_CHANNEL_ID로 URL 조합
 */
function getKakaoChannelUrl(): string | null {
  // 클라이언트 컴포넌트이므로 process.env.NEXT_PUBLIC_ 접두사 필요
  const channelUrl = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL;
  const channelId = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID;

  if (channelUrl) {
    console.log("[KakaoChannelButton] 채널 URL 사용:", channelUrl);
    return channelUrl;
  }

  if (channelId) {
    // 카카오톡 채널 URL 형식: https://pf.kakao.com/_xxxxxxx 또는 https://open.kakao.com/o/xxxxxxx
    // ID가 이미 URL 형식이면 그대로 사용, 아니면 pf.kakao.com 형식으로 조합
    if (channelId.startsWith("http")) {
      console.log("[KakaoChannelButton] 채널 ID (URL 형식) 사용:", channelId);
      return channelId;
    }
    const url = `https://pf.kakao.com/_${channelId}`;
    console.log("[KakaoChannelButton] 채널 ID로 URL 생성:", url);
    return url;
  }

  console.warn(
    "[KakaoChannelButton] ⚠️ 카카오 채널 URL/ID가 설정되지 않았습니다.",
  );
  return null;
}

export default function KakaoChannelButton({
  variant = "default",
  fullWidth = false,
  locationTag,
  description,
  buttonText = "카카오톡 채널 추가",
}: KakaoChannelButtonProps) {
  // 클라이언트에서만 환경 변수를 읽어 Hydration 에러 방지
  const [channelUrl, setChannelUrl] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const url = getKakaoChannelUrl();
    setChannelUrl(url);
  }, []);

  // 채널 URL이 없으면 버튼을 렌더링하지 않음
  if (!isMounted || !channelUrl) {
    if (isMounted && locationTag) {
      console.warn(
        `[KakaoChannelButton] ${locationTag}: 채널 URL이 설정되지 않아 버튼을 표시하지 않습니다.`,
      );
    }
    return null;
  }

  // 버튼 크기 스타일
  const sizeClass = {
    sm: "h-7 px-2 text-xs",
    default: "h-11 px-4 text-base",
    lg: "h-12 px-6 text-lg",
  }[variant];

  // 클릭 핸들러 (로깅)
  const handleClick = () => {
    console.group(
      `[KakaoChannelButton] 카카오톡 채널 버튼 클릭${
        locationTag ? ` (${locationTag})` : ""
      }`,
    );
    console.log("채널 URL:", channelUrl);
    console.log("새 탭으로 열기");
    console.groupEnd();
  };

  return (
    <div className={`flex flex-col gap-2 ${fullWidth ? "w-full" : ""}`}>
      {description && (
        <p className="text-sm text-[#8b7d84] text-center">{description}</p>
      )}
      <Button
        asChild
        className={`
          ${sizeClass}
          ${fullWidth ? "w-full" : ""}
          bg-[#FEE500] hover:bg-[#FEE500]/90
          text-[#3C1E1E] font-semibold
          ${variant === "sm" ? "shadow-none" : "shadow-md hover:shadow-lg"}
          transition-all duration-200
          rounded-md
        `}
        onClick={handleClick}
      >
        <Link
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5"
        >
          <MessageCircle className={variant === "sm" ? "w-4 h-4" : "w-5 h-5"} />
          {buttonText}
        </Link>
      </Button>
    </div>
  );
}
