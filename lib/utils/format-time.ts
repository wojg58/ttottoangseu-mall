/**
 * @file lib/utils/format-time.ts
 * @description 시간 포맷팅 유틸리티
 * 
 * UTC 시간을 한국 시간(KST)으로 변환하여 표시하는 유틸리티 함수들
 */

/**
 * UTC 시간을 한국 시간(KST) 문자열로 변환
 * 
 * @param date - Date 객체 또는 ISO 문자열
 * @param format - 포맷 형식 ('datetime' | 'date' | 'time')
 * @returns 한국 시간으로 포맷팅된 문자열
 * 
 * @example
 * ```typescript
 * formatKoreaTime('2026-01-09T11:17:21.70393+00:00')
 * // "2026년 1월 9일 오후 08:17:21"
 * ```
 */
export function formatKoreaTime(
  date: string | Date,
  format: "datetime" | "date" | "time" = "datetime"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: format === "datetime" || format === "time" ? "2-digit" : undefined,
  });

  return formatter.format(dateObj);
}

/**
 * 로그용 간단한 한국 시간 포맷
 * 
 * @param date - Date 객체 또는 ISO 문자열
 * @returns "YYYY-MM-DD HH:MM:SS (KST)" 형식의 문자열
 * 
 * @example
 * ```typescript
 * formatKoreaTimeForLog('2026-01-09T11:17:21.70393+00:00')
 * // "2026-01-09 20:17:21 (KST)"
 * ```
 */
export function formatKoreaTimeForLog(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const formatted = formatter.format(dateObj);
  // "2026. 1. 9. 20:17:21" 형식을 "2026-01-09 20:17:21"로 변환
  return formatted.replace(/\. /g, "-").replace(/\./g, "").replace(/-(\d)-/g, "-0$1-").replace(/-(\d)$/g, "-0$1") + " (KST)";
}

/**
 * 객체의 시간 필드를 한국 시간으로 변환하여 반환
 * 
 * @param obj - 시간 필드가 포함된 객체
 * @param timeFields - 변환할 시간 필드명 배열 (예: ['created_at', 'updated_at'])
 * @returns 시간 필드가 한국 시간 문자열로 변환된 객체
 */
export function convertTimeFieldsToKoreaTime<T extends Record<string, unknown>>(
  obj: T,
  timeFields: string[] = ["created_at", "updated_at", "paid_at", "approved_at"]
): T {
  const converted = { ...obj };
  
  for (const field of timeFields) {
    if (field in converted && converted[field]) {
      const value = converted[field];
      if (typeof value === "string" || value instanceof Date) {
        converted[field] = formatKoreaTimeForLog(value) as T[Extract<keyof T, string>];
      }
    }
  }
  
  return converted;
}

