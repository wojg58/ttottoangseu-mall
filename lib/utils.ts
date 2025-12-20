import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 숫자를 한국 원화 형식으로 포맷팅
 * @param price - 포맷팅할 가격
 * @param options - 포맷팅 옵션
 * @returns 포맷팅된 문자열 (예: "12,000원")
 */
export function formatPrice(
  price: number,
  options: {
    /** 원화 표시 여부 (기본: true) */
    showCurrency?: boolean;
    /** 천 단위 구분자 (기본: ",") */
    separator?: string;
  } = {}
): string {
  const { showCurrency = true, separator = "," } = options;

  const formatted = price
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return showCurrency ? `${formatted}원` : formatted;
}

/**
 * 숫자를 한국어 형식으로 포맷팅 (toLocaleString 대체)
 * SSR/CSR 일관성을 위해 수동 포맷팅 사용
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
