/**
 * @file lib/utils/format-time.ts
 * @description 시간 포맷팅 유틸리티
 * 
 * UTC 시간을 한국 시간(KST)으로 변환하여 표시하는 유틸리티 함수들
 * 
 * Supabase는 UTC 기준으로 시간을 저장하므로,
 * 화면 표시 시에만 KST로 변환합니다.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// dayjs 플러그인 확장
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * UTC 시간을 한국 시간(KST) 문자열로 변환
 * 
 * @param date - Date 객체 또는 ISO 문자열 (UTC)
 * @param format - 포맷 형식 ('datetime' | 'date' | 'time' | 'short')
 * @returns 한국 시간으로 포맷팅된 문자열
 * 
 * @example
 * ```typescript
 * formatKoreaTime('2026-01-09T11:17:21.70393+00:00', 'datetime')
 * // "2026년 1월 9일 오후 08:17:21"
 * 
 * formatKoreaTime('2026-01-09T11:17:21.70393+00:00', 'short')
 * // "1월 9일 20:17"
 * ```
 */
export function formatKoreaTime(
  date: string | Date,
  format: "datetime" | "date" | "time" | "short" = "datetime"
): string {
  // UTC 시간을 KST로 변환
  const kstTime = dayjs.utc(date).tz("Asia/Seoul");

  switch (format) {
    case "datetime":
      return kstTime.format("YYYY년 M월 D일 HH:mm:ss");
    case "date":
      return kstTime.format("YYYY년 M월 D일");
    case "time":
      return kstTime.format("HH:mm:ss");
    case "short":
      return kstTime.format("M월 D일 HH:mm");
    default:
      return kstTime.format("YYYY-MM-DD HH:mm:ss");
  }
}

/**
 * 로그용 간단한 한국 시간 포맷
 * 
 * @param date - Date 객체 또는 ISO 문자열 (UTC)
 * @returns "YYYY-MM-DD HH:MM:SS (KST)" 형식의 문자열
 * 
 * @example
 * ```typescript
 * formatKoreaTimeForLog('2026-01-09T11:17:21.70393+00:00')
 * // "2026-01-09 20:17:21 (KST)"
 * ```
 */
export function formatKoreaTimeForLog(date: string | Date): string {
  const kstTime = dayjs.utc(date).tz("Asia/Seoul");
  return `${kstTime.format("YYYY-MM-DD HH:mm:ss")} (KST)`;
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
  const converted = { ...obj } as T;
  
  for (const field of timeFields) {
    if (field in converted && converted[field]) {
      const value = converted[field];
      if (typeof value === "string" || value instanceof Date) {
        (converted as Record<string, unknown>)[field] = formatKoreaTimeForLog(value);
      }
    }
  }
  
  return converted;
}

