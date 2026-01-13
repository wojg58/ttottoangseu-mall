/**
 * @file lib/notifications/formatTime.ts
 * @description 알림용 시간 포맷팅 유틸리티
 *
 * UTC 시간을 한국 시간(KST)으로 변환하여 알림톡/이메일 메시지에 사용
 * 
 * 주의: DB에는 UTC로 저장하고, 표시/알림용으로만 KST 변환
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// dayjs 플러그인 확장
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * UTC 시간을 한국 시간(KST) 문자열로 변환 (알림용)
 * 
 * @param date - Date 객체 또는 ISO 문자열 (UTC)
 * @returns "YYYY-MM-DD HH:mm" 형식의 KST 문자열
 * 
 * @example
 * ```typescript
 * formatTimeForNotification('2026-01-12T01:55:27.000Z')
 * // "2026-01-12 10:55"
 * ```
 */
export function formatTimeForNotification(date: string | Date): string {
  const kstTime = dayjs.utc(date).tz("Asia/Seoul");
  return kstTime.format("YYYY-MM-DD HH:mm");
}

/**
 * UTC 시간을 한국 시간(KST) 문자열로 변환 (한글 포맷)
 * 
 * @param date - Date 객체 또는 ISO 문자열 (UTC)
 * @returns "YYYY년 MM월 DD일 HH:mm:ss" 형식의 KST 문자열
 * 
 * @example
 * ```typescript
 * formatTimeForNotificationKo('2026-01-12T01:55:27.000Z')
 * // "2026년 01월 12일 10:55:27"
 * ```
 */
export function formatTimeForNotificationKo(date: string | Date): string {
  const kstTime = dayjs.utc(date).tz("Asia/Seoul");
  return kstTime.format("YYYY년 MM월 DD일 HH:mm:ss");
}



