/**
 * @file lib/utils/payment-method.ts
 * @description 결제 수단 정규화 유틸리티
 * 
 * 토스페이먼츠 API는 한글("카드") 또는 영어 대문자("CARD")를 반환할 수 있으므로
 * 이를 데이터베이스에서 허용하는 소문자 영어 형식으로 변환합니다.
 */

import type { PaymentMethod } from "@/types/database";

/**
 * 토스페이먼츠 결제 수단을 데이터베이스 형식으로 변환
 * 
 * @param method - 토스페이먼츠에서 반환한 결제 수단 (한글 또는 영어)
 * @returns 데이터베이스에 저장할 결제 수단 (소문자 영어)
 * 
 * @example
 * ```typescript
 * normalizePaymentMethod("카드") // "card"
 * normalizePaymentMethod("CARD") // "card"
 * normalizePaymentMethod("가상계좌") // "virtual_account"
 * ```
 */
export function normalizePaymentMethod(method: string): PaymentMethod {
  const normalized = method.toLowerCase().trim();
  
  // 한글 매핑
  const koreanMapping: Record<string, PaymentMethod> = {
    "카드": "card",
    "가상계좌": "virtual_account",
    "계좌이체": "transfer",
    "휴대폰": "mobile",
    "휴대폰소액결제": "mobile",
    "기타": "etc",
  };
  
  // 한글이면 매핑된 값 반환
  if (koreanMapping[method]) {
    return koreanMapping[method];
  }
  
  // 영어 대문자/소문자 처리
  if (normalized === "card" || normalized === "credit" || normalized === "debit") {
    return "card";
  }
  if (normalized === "virtual_account" || normalized === "virtualaccount") {
    return "virtual_account";
  }
  if (normalized === "transfer" || normalized === "account") {
    return "transfer";
  }
  if (normalized === "mobile" || normalized === "phone") {
    return "mobile";
  }
  
  // 기본값: etc
  return "etc";
}

