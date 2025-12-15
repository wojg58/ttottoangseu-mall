/**
 * @file components/number-display.tsx
 * @description 숫자 표시 컴포넌트 (hydration 오류 방지)
 * 
 * 서버와 클라이언트에서 숫자 포맷팅이 다를 수 있어 hydration 오류가 발생할 수 있습니다.
 * 이 컴포넌트는 클라이언트에서만 숫자를 포맷팅하여 문제를 해결합니다.
 */

"use client";

import { useEffect, useState } from "react";

interface NumberDisplayProps {
  value: number;
  suffix?: string; // 예: "원", "개" 등
  className?: string;
}

export default function NumberDisplay({
  value,
  suffix = "",
  className,
}: NumberDisplayProps) {
  const [mounted, setMounted] = useState(false);
  const [formattedValue, setFormattedValue] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    setFormattedValue(value.toLocaleString("ko-KR"));
  }, [value]);

  // 서버 사이드 렌더링 시에는 원본 숫자를 표시 (hydration 일치)
  if (!mounted) {
    return (
      <span className={className}>
        {value}
        {suffix}
      </span>
    );
  }

  return (
    <span className={className}>
      {formattedValue}
      {suffix}
    </span>
  );
}

