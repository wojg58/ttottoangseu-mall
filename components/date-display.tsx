/**
 * @file components/date-display.tsx
 * @description 날짜 표시 컴포넌트 (hydration 오류 방지)
 * 
 * 서버와 클라이언트에서 날짜 포맷팅이 다를 수 있어 hydration 오류가 발생할 수 있습니다.
 * 이 컴포넌트는 클라이언트에서만 날짜를 포맷팅하여 문제를 해결합니다.
 */

"use client";

import { useEffect, useState } from "react";

interface DateDisplayProps {
  date: string | Date;
  format?: "date" | "datetime" | "short";
  className?: string;
}

export default function DateDisplay({
  date,
  format = "date",
  className,
}: DateDisplayProps) {
  const [mounted, setMounted] = useState(false);
  const [formattedDate, setFormattedDate] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    
    // UTC 시간 문자열을 Date 객체로 변환
    const dateObj = typeof date === "string" ? new Date(date) : date;

    // Intl.DateTimeFormat을 사용하여 한국 시간대로 명시적으로 변환
    const koreaFormatter = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
    });

    if (format === "datetime") {
      const formatter = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setFormattedDate(formatter.format(dateObj));
    } else if (format === "short") {
      const formatter = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      setFormattedDate(formatter.format(dateObj));
    } else {
      const formatter = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
      });
      setFormattedDate(formatter.format(dateObj));
    }
  }, [date, format]);

  // 서버 사이드 렌더링 시에는 ISO 날짜 문자열을 표시 (hydration 일치)
  if (!mounted) {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const isoString = dateObj.toISOString().split("T")[0];
    return <span className={className}>{isoString}</span>;
  }

  return <span className={className}>{formattedDate}</span>;
}

